import { supabaseAdmin } from './supabase';
import { CAPACITY, topicById, formatSaturday } from './topics';

// Renvoie toutes les sessions à venir (aujourd'hui inclus), triées de la plus
// remplie (donc la plus susceptible d'être programmée) à la moins remplie.
export async function getOpenSessions() {
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from('workshop_sessions')
    .select('id, topic_id, session_date, validated, workshop_registrations(count)')
    .gte('session_date', today);

  if (error) throw error;

  const withRate = (data || [])
    .map((row) => {
      const count = row.workshop_registrations?.[0]?.count ?? 0;
      return {
        id: row.id,
        topicId: row.topic_id,
        topic: topicById(row.topic_id),
        dateIso: row.session_date,
        dateLabel: formatSaturday(row.session_date),
        validated: row.validated,
        count,
        capacity: CAPACITY,
        rate: count / CAPACITY,
      };
    })
    .filter((s) => s.topic); // ignore les sessions dont le topic aurait été retiré

  withRate.sort((a, b) => b.rate - a.rate || a.dateIso.localeCompare(b.dateIso));
  return withRate;
}
