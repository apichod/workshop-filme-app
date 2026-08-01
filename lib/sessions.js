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
