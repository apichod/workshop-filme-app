import { supabaseAdmin } from './supabase';
import { CAPACITY, VALIDATION_THRESHOLD, getAllTopics, getTopicById, formatSaturday, isoDate } from './topics';
import { sendWorkshopCancelledDateTaken } from './mailer';

// Seuil de validation effectif d'une formation : sa valeur propre si définie
// (0 inclus — 0 signifie "priorité totale", cf. isPriorityTopic), sinon le
// seuil global VALIDATION_THRESHOLD.
export function effectiveThreshold(topic) {
  return Number.isFinite(topic?.minParticipants) ? topic.minParticipants : VALIDATION_THRESHOLD;
}

// Une formation "prioritaire" monopolise sa date dès la 1ère inscription :
// elle annule tout autre évènement programmé ce jour-là, même déjà validé,
// et n'est elle-même jamais bloquée par une autre formation déjà validée.
// Deux façons d'être prioritaire : seuil de validation à 0, ou date fixe.
export function isPriorityTopic(topic) {
  return !!topic && (effectiveThreshold(topic) === 0 || !!topic.fixedDate);
}

// Renvoie toutes les sessions à venir (aujourd'hui inclus), triées de la plus
// remplie (donc la plus susceptible d'être programmée) à la moins remplie.
export async function getOpenSessions() {
  const today = isoDate(new Date());

  const [{ data, error }, topics] = await Promise.all([
    supabaseAdmin
      .from('workshop_sessions')
      .select('id, topic_id, session_date, validated, workshop_registrations(count)')
      .gte('session_date', today),
    getAllTopics(), // inclut les formations archivées : une session déjà ouverte doit rester visible
  ]);

  if (error) throw error;

  const topicsById = new Map(topics.map((t) => [t.id, t]));

  const withRate = (data || [])
    .map((row) => {
      const count = row.workshop_registrations?.[0]?.count ?? 0;
      const topic = topicsById.get(row.topic_id) || null;
      const threshold = effectiveThreshold(topic);
      return {
        id: row.id,
        topicId: row.topic_id,
        topic,
        dateIso: row.session_date,
        dateLabel: formatSaturday(row.session_date),
        validated: row.validated,
        count,
        capacity: topic?.maxParticipants || CAPACITY,
        threshold,
        // La "probabilité d'être programmée" est liée au seuil de validation
        // (VALIDATION_THRESHOLD ou le seuil propre à la formation), pas à la
        // capacité max : une session validée est à 100% même si elle n'est pas
        // encore pleine. Un seuil à 0 (priorité totale) est toujours à 100%.
        rate: threshold === 0 ? 1 : Math.min(count / threshold, 1),
      };
    })
    .filter((s) => s.topic); // ignore les sessions dont le topic aurait été supprimé de la base

  withRate.sort((a, b) => b.rate - a.rate || a.dateIso.localeCompare(b.dateIso));
  return withRate;
}

// Sessions à venir avec le détail des inscrits — pour la popup admin
// "Préférences → Inscriptions" (retrait manuel d'un inscrit).
export async function getSessionsWithRegistrantsAdmin() {
  const today = isoDate(new Date());

  const [{ data, error }, topics] = await Promise.all([
    supabaseAdmin
      .from('workshop_sessions')
      .select('id, topic_id, session_date, validated, workshop_registrations(id, name, email, created_at)')
      .gte('session_date', today)
      .order('session_date', { ascending: true }),
    getAllTopics(),
  ]);
  if (error) throw error;

  const topicsById = new Map(topics.map((t) => [t.id, t]));

  return (data || [])
    .map((row) => ({
      id: row.id,
      topicId: row.topic_id,
      topic: topicsById.get(row.topic_id) || null,
      dateIso: row.session_date,
      dateLabel: formatSaturday(row.session_date),
      validated: row.validated,
      registrants: (row.workshop_registrations || [])
        .slice()
        .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
        .map((r) => ({ id: r.id, name: r.name, email: r.email })),
    }))
    .filter((s) => s.topic && s.registrants.length > 0);
}

// Inscriptions à venir pour un email donné — pour la page cliente
// "/mes-inscriptions" (auto-gestion / annulation par le client lui-même).
export async function getRegistrationsForEmail(email) {
  const normalized = (email || '').trim().toLowerCase();
  const today = isoDate(new Date());

  const [{ data, error }, topics] = await Promise.all([
    supabaseAdmin
      .from('workshop_registrations')
      .select('id, session_id, email, workshop_sessions(id, topic_id, session_date, validated)')
      .eq('email', normalized),
    getAllTopics(),
  ]);
  if (error) throw error;

  const topicsById = new Map(topics.map((t) => [t.id, t]));

  return (data || [])
    .filter((r) => r.workshop_sessions && r.workshop_sessions.session_date >= today)
    .map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      topicId: r.workshop_sessions.topic_id,
      topicTitle: topicsById.get(r.workshop_sessions.topic_id)?.title || r.workshop_sessions.topic_id,
      dateIso: r.workshop_sessions.session_date,
      dateLabel: formatSaturday(r.workshop_sessions.session_date),
      validated: r.workshop_sessions.validated,
    }))
    .sort((a, b) => a.dateIso.localeCompare(b.dateIso));
}

// ─── Retrait d'un inscrit — logique partagée entre l'admin (Préférences →
// Inscriptions) et le client (/mes-inscriptions) ────────────────────────────

export async function getRegistrationById(id) {
  const { data, error } = await supabaseAdmin
    .from('workshop_registrations')
    .select('id, session_id, email, name')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Supprime l'inscription, puis repasse la session en "non validée" si le
// nombre d'inscrits restant repasse sous le seuil de validation — pour rester
// cohérent avec le reste du site (badge, couleur de la barre, emails).
export async function deleteRegistration(reg) {
  const { error: delErr } = await supabaseAdmin.from('workshop_registrations').delete().eq('id', reg.id);
  if (delErr) throw delErr;

  const { count, error: countErr } = await supabaseAdmin
    .from('workshop_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', reg.session_id);
  if (countErr) throw countErr;

  // Seuil propre à la formation si elle en a un (une formation à seuil 0 reste
  // toujours validée, quel que soit le nombre d'inscrits restants).
  const { data: sessionRow } = await supabaseAdmin
    .from('workshop_sessions')
    .select('topic_id')
    .eq('id', reg.session_id)
    .maybeSingle();
  const topic = sessionRow ? await getTopicById(sessionRow.topic_id) : null;
  const threshold = effectiveThreshold(topic);

  if ((count || 0) < threshold) {
    await supabaseAdmin.from('workshop_sessions').update({ validated: false }).eq('id', reg.session_id);
  }

  return count || 0;
}

// ─── Un seul workshop par samedi ────────────────────────────────────────────
// Dès qu'une session atteint son seuil de validation, toutes les autres
// sessions (autres formations) pas encore validées à la même date sont
// annulées — les inscrits concernés sont prévenus par email et invités à
// proposer une autre disponibilité.
// `opts.fullPriority` : si vrai, annule TOUTES les autres sessions à cette
// date, y compris celles déjà validées (utilisé pour les formations
// prioritaires — seuil 0 ou date fixe).
// `opts.excludeTopicId` : exclut une formation entière plutôt qu'une session
// précise (utile quand aucune session n'existe encore pour la formation
// gagnante, ex. réservation d'une date fixe avant toute inscription).
export async function cancelConflictingSessions(dateIso, keepSessionId, winningTopic, dateLabel, opts = {}) {
  const { fullPriority = false, excludeTopicId = null } = opts;

  let query = supabaseAdmin
    .from('workshop_sessions')
    .select('id, topic_id, workshop_registrations(name, email)')
    .eq('session_date', dateIso);
  if (!fullPriority) query = query.eq('validated', false);
  if (keepSessionId) query = query.neq('id', keepSessionId);
  if (excludeTopicId) query = query.neq('topic_id', excludeTopicId);

  const { data: others, error } = await query;
  if (error) throw error;
  if (!others || others.length === 0) return;

  const topics = await getAllTopics();
  const topicsById = new Map(topics.map((t) => [t.id, t]));

  for (const s of others) {
    const cancelledTopic = topicsById.get(s.topic_id) || { title: 'Cette formation' };
    const registrants = s.workshop_registrations || [];
    if (registrants.length > 0) {
      await sendWorkshopCancelledDateTaken(registrants, cancelledTopic, dateLabel, winningTopic);
    }
    // La suppression de la session entraîne celle de ses inscriptions
    // (workshop_registrations.session_id → on delete cascade).
    await supabaseAdmin.from('workshop_sessions').delete().eq('id', s.id);
  }
}

// Réserve immédiatement la date fixe d'une formation : annule tout autre
// évènement déjà programmé ce jour-là (même validé), sans attendre une
// inscription. Appelée dès que l'admin enregistre/modifie une date fixe.
export async function enforceFixedDateExclusivity(topic) {
  if (!topic?.fixedDate) return;
  const dateLabel = formatSaturday(topic.fixedDate);
  await cancelConflictingSessions(topic.fixedDate, null, topic, dateLabel, {
    fullPriority: true,
    excludeTopicId: topic.id,
  });
}

// Un autre atelier a-t-il déjà été validé à cette date ? (formation différente)
// — ou cette date est-elle réservée par la date fixe d'une autre formation,
// même si aucune session n'y a encore été ouverte.
export async function isDateTakenByAnotherTopic(dateIso, topicId) {
  const [{ data: validatedSession, error: sessionErr }, { data: fixedDateTopic, error: topicErr }] = await Promise.all([
    supabaseAdmin
      .from('workshop_sessions')
      .select('id')
      .eq('session_date', dateIso)
      .eq('validated', true)
      .neq('topic_id', topicId)
      .maybeSingle(),
    supabaseAdmin
      .from('workshop_topics')
      .select('id')
      .eq('fixed_date', dateIso)
      .neq('id', topicId)
      .limit(1),
  ]);
  if (sessionErr) throw sessionErr;
  if (topicErr) throw topicErr;
  return !!validatedSession || (fixedDateTopic && fixedDateTopic.length > 0);
}
