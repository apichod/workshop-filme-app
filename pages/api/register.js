import { supabaseAdmin } from '../../lib/supabase';
import { getCustomerByEmail } from '../../lib/booqable';
import { sendWorkshopConfirmation, sendWorkshopValidated } from '../../lib/mailer';
import { CAPACITY, getTopicById, isValidWeekdayDate, topicWeekday, formatSaturday } from '../../lib/topics';
import { isDateClosed } from '../../lib/closedDates';
import { cancelConflictingSessions, isDateTakenByAnotherTopic, effectiveThreshold, isPriorityTopic } from '../../lib/sessions';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { topicId, dateIso, name, email } = req.body || {};

  if (!name?.trim() || !email?.trim()) return res.status(400).json({ error: 'Nom et email requis' });

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const topic = await getTopicById(topicId);
    if (!topic) return res.status(400).json({ error: 'Formation inconnue' });
    const capacity = topic.maxParticipants || CAPACITY;
    const threshold = effectiveThreshold(topic);
    const priority = isPriorityTopic(topic);

    // ─── Une formation à date fixe ne peut recevoir d'inscription que pour
    // cette date précise (n'importe quel jour de la semaine) ; les autres
    // formations sont limitées aux occurrences à venir de leur jour de
    // semaine (mercredi/vendredi/samedi selon leur planning). ─────────────
    if (topic.fixedDate) {
      if (dateIso !== topic.fixedDate) return res.status(400).json({ error: 'date_closed' });
    } else if (!isValidWeekdayDate(dateIso, topicWeekday(topic))) {
      return res.status(400).json({ error: 'Merci de choisir une date valide à venir' });
    }

    // ─── Ce samedi a-t-il été fermé aux inscriptions (préférences admin) ? ───
    if (await isDateClosed(dateIso)) return res.status(400).json({ error: 'date_closed' });

    // ─── Un seul workshop par samedi : une autre formation est-elle déjà
    // validée (ou réservée via une date fixe) à cette date ? Une formation
    // prioritaire (seuil 0 ou date fixe) passe outre ce blocage. ───────────
    if (!priority && (await isDateTakenByAnotherTopic(dateIso, topicId))) {
      return res.status(400).json({ error: 'date_taken' });
    }

    // ─── Vérification "client Filme" via Booqable (même lib que monespace.filme.fr) ───
    const customer = await getCustomerByEmail(normalizedEmail);
    if (!customer) return res.status(403).json({ error: 'no_account' });

    // ─── Récupère ou crée la session (topic + samedi) ───
    let { data: session, error: fetchErr } = await supabaseAdmin
      .from('workshop_sessions')
      .select('*')
      .eq('topic_id', topicId)
      .eq('session_date', dateIso)
      .maybeSingle();
    if (fetchErr) throw fetchErr;

    // Une formation archivée ne peut plus ouvrir de nouvelle session, mais on
    // n'annule pas les sessions déjà ouvertes avant son archivage.
    if (!session && topic.archived) {
      return res.status(400).json({ error: 'topic_archived' });
    }

    if (!session) {
      const { data: created, error: createErr } = await supabaseAdmin
        .from('workshop_sessions')
        .insert({ topic_id: topicId, session_date: dateIso })
        .select()
        .single();
      if (createErr) throw createErr;
      session = created;
    }

    const wasValidated = session.validated;

    const { count, error: countErr } = await supabaseAdmin
      .from('workshop_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id);
    if (countErr) throw countErr;
    // Une session validée (>= seuil) reste ouverte aux inscriptions jusqu'à la
    // capacité max — seule la capacité bloque, pas la validation.
    if ((count || 0) >= capacity) return res.status(409).json({ error: 'full' });

    // ─── Inscription (unique par session+email, cf. supabase.sql) ───
    const { error: insertErr } = await supabaseAdmin
      .from('workshop_registrations')
      .insert({ session_id: session.id, customer_id: customer.id, name: name.trim(), email: normalizedEmail });

    if (insertErr) {
      if (insertErr.code === '23505') return res.status(409).json({ error: 'already_registered' });
      throw insertErr;
    }

    const newCount = (count || 0) + 1;
    const dateLabel = formatSaturday(dateIso);
    const justCrossedThreshold = !wasValidated && newCount >= threshold;
    const nowValidated = wasValidated || justCrossedThreshold;

    if (justCrossedThreshold) {
      // Première fois que le seuil est atteint (immédiatement si seuil 0) : on
      // marque la session validée et on prévient TOUS les inscrits (pas
      // seulement le dernier).
      await supabaseAdmin.from('workshop_sessions').update({ validated: true }).eq('id', session.id);
      const { data: registrants } = await supabaseAdmin
        .from('workshop_registrations')
        .select('name, email')
        .eq('session_id', session.id);
      await sendWorkshopValidated(registrants || [], topic, dateLabel);

      // Un seul évènement par date : on annule les autres formations pas
      // encore validées proposées à cette même date — ou absolument toutes
      // (même déjà validées) si cette formation est prioritaire.
      await cancelConflictingSessions(dateIso, session.id, topic, dateLabel, { fullPriority: priority });
    } else {
      await sendWorkshopConfirmation(normalizedEmail, name.trim(), topic, dateLabel, {
        alreadyValidated: nowValidated,
        placesBeforeValidation: Math.max(0, threshold - newCount),
      });
    }

    return res.status(200).json({
      ok: true,
      count: newCount,
      validated: nowValidated,
      full: newCount >= capacity,
    });
  } catch (err) {
    console.error('[api/register]', err);
    return res.status(500).json({ error: 'Erreur serveur, réessayez.' });
  }
}
