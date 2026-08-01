import { supabaseAdmin } from './supabase';

// ─── Samedis exclus des inscriptions (préférences admin) ─────────────────────
// Une date présente dans workshop_closed_dates n'est pas proposée à
// l'inscription (ni dans le formulaire, ni acceptée côté API).

export async function getClosedDates() {
  const { data, error } = await supabaseAdmin.from('workshop_closed_dates').select('date');
  if (error) throw error;
  return (data || []).map((r) => r.date);
}

export async function isDateClosed(dateIso) {
  const { data, error } = await supabaseAdmin
    .from('workshop_closed_dates')
    .select('date')
    .eq('date', dateIso)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function setClosedDate(dateIso, closed) {
  if (closed) {
    const { error } = await supabaseAdmin.from('workshop_closed_dates').upsert({ date: dateIso });
    if (error) throw error;
  } else {
    const { error } = await supabaseAdmin.from('workshop_closed_dates').delete().eq('date', dateIso);
    if (error) throw error;
  }
  return { date: dateIso, closed: !!closed };
}
