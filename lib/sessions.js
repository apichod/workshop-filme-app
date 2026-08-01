import { supabaseAdmin } from './supabase';
import { CAPACITY, getAllTopics, formatSaturday, isoDate } from './topics';

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
        rate: count / CAPACITY,
      };
    })
    .filter((s) => s.topic); // ignore les sessions dont le topic aurait été supprimé de la base

  withRate.sort((a, b) => b.rate - a.rate || a.dateIso.localeCompare(b.dateIso));
  return withRate;
}
