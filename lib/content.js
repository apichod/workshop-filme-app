import { supabaseAdmin } from './supabase';

// Textes de la homepage éditables depuis l'admin (hors prix/capacité, qui
// restent des constantes de code dans lib/topics.js car ils ont un impact
// direct sur la logique métier — le seuil de validation à 6, notamment).
// Valeurs par défaut utilisées tant que la table n'est pas migrée / si une
// clé n'a pas encore de ligne en base.
export const CONTENT_DEFAULTS = {
  price_label: '149 € HT / personne',
  hero_title: 'Les ateliers du samedi, avec le matériel que vous louez déjà.',
  hero_lead: "Une journée 100% pratique (9h–18h) chez Filme à Montreuil, 6 participants maximum, pour prendre en main le matériel avant votre prochain tournage.",
  pill_capacity: '6 places max par session',
  pill_audience: 'Réservé aux clients Filme',
  pill_validation: 'Validée dès 6 inscrits',
  sessions_heading: 'Sessions ouvertes',
  sessions_hint: "Triées de la plus remplie (la plus susceptible d'être programmée) à la moins remplie",
  topics_heading: 'Les formations',
  topics_hint: 'Choisissez une formation pour proposer ou rejoindre un ou plusieurs samedis',
  footer_text: 'Filme — Location de matériel audiovisuel · Montreuil',
  footer_email: 'location@filme.fr',
};

export async function getSiteContent() {
  const { data, error } = await supabaseAdmin.from('workshop_site_content').select('key, value');
  if (error) throw error;
  const map = { ...CONTENT_DEFAULTS };
  (data || []).forEach((row) => { map[row.key] = row.value; });
  return map;
}

export async function updateSiteContentKey(key, value) {
  if (!(key in CONTENT_DEFAULTS)) throw new Error('Clé de contenu inconnue');
  const { data, error } = await supabaseAdmin
    .from('workshop_site_content')
    .upsert({ key, value: value ?? '', updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data.value;
}
