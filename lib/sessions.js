import { supabaseAdmin } from './supabase';
import { CAPACITY, VALIDATION_THRESHOLD, getAllTopics, formatSaturday, isoDate } from './topics';

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
      return {
        id: row.id,
        topicId: row.topic_id,
        topic: topicsById.get(row.topic_id) || null,
        dateIso: row.session_date,
        dateLabel: formatSaturday(row.session_date),
        validated: row.validated,
        count,
        capacity: CAPACITY,
        threshold: VALIDATION_THRESHOLD,
        // La "probabilité d'être programmée" est liée au seuil de validation (4),
        // pas à la capacité max (10) : une session validée est à 100% même si elle
        // n'est pas encore pleine.
        rate: Math.min(count / VALIDATION_THRESHOLD, 1),
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

  if ((count || 0) < VALIDATION_THRESHOLD) {
    await supabaseAdmin.from('workshop_sessions').update({ validated: false }).eq('id', reg.session_id);
  }

  return count || 0;
}
