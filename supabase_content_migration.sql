-- À coller dans Supabase (projet "workshop-filme") → SQL Editor → Run
-- Ajoute les textes de la homepage (hors prix/capacité, qui restent dans le
-- code car ils ont un impact sur la logique métier) sous forme clé/valeur,
-- éditables directement depuis la homepage en mode admin.

create table if not exists workshop_site_content (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

insert into workshop_site_content (key, value) values
('price_label', '149 € HT / personne'),
('hero_title', 'Les ateliers du samedi, avec le matériel que vous louez déjà.'),
('hero_lead', 'Une journée 100% pratique (9h–18h) chez Filme à Montreuil, 6 participants maximum, pour prendre en main le matériel avant votre prochain tournage.'),
('pill_capacity', '6 places max par session'),
('pill_audience', 'Réservé aux clients Filme'),
('pill_validation', 'Validée dès 6 inscrits'),
('sessions_heading', 'Sessions ouvertes'),
('sessions_hint', 'Triées de la plus remplie (la plus susceptible d''être programmée) à la moins remplie'),
('topics_heading', 'Les formations'),
('topics_hint', 'Choisissez une formation pour proposer ou rejoindre un ou plusieurs samedis'),
('footer_text', 'Filme — Location de matériel audiovisuel · Montreuil'),
('footer_email', 'location@filme.fr')
on conflict (key) do nothing;
