-- À coller dans Supabase → SQL Editor → Run
-- Script de "réparation" complet : regroupe TOUTES les migrations du projet
-- (supabase.sql, supabase_topics_migration.sql,
-- supabase_topics_fields_migration.sql,
-- supabase_topics_category_bonus_migration.sql, supabase_content_migration.sql,
-- supabase_closed_dates_migration.sql) en un seul script.
--
-- Sans danger à exécuter à tout moment, même si tout ou partie existe déjà :
-- chaque étape utilise "if not exists" / "on conflict do nothing", donc ce qui
-- est déjà en place est simplement ignoré, et seul ce qui manque est créé.

-- ─── 1. Tables de base (sessions, inscriptions) ──────────────────────────────

create table if not exists workshop_sessions (
  id uuid primary key default gen_random_uuid(),
  topic_id text not null,
  session_date date not null,
  validated boolean not null default false,
  created_at timestamptz not null default now(),
  unique (topic_id, session_date)
);

create table if not exists workshop_registrations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references workshop_sessions(id) on delete cascade,
  customer_id text,
  name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  unique (session_id, email)
);

create index if not exists idx_workshop_sessions_date on workshop_sessions (session_date);
create index if not exists idx_workshop_registrations_session on workshop_registrations (session_id);

-- ─── 2. Formations (table + 10 formations de base + FK) ──────────────────────

create table if not exists workshop_topics (
  id text primary key,
  title text not null,
  level text,
  description text,
  archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into workshop_topics (id, title, level, description, sort_order) values
('ronin4d', 'Ronin 4D – Prise en main complète', 'Débutant à intermédiaire', 'Prise en main du DJI Ronin 4D : configuration, équilibrage, mise au point, modes de stabilisation, mouvements de caméra, bonnes pratiques de tournage et exercices en conditions réelles.', 1),
('rs3pro', 'DJI RS 4 Pro – Stabilisation gimbal caméra', 'Débutant', 'Montage caméra, équilibrage rapide, modes de suivi et mouvements fluides avec le gimbal DJI RS 4 Pro, en conditions réelles de tournage.', 2),
('fpv', 'Drone FPV cinématique – Pilotage & prises de vue', 'Intermédiaire', 'Bases du pilotage FPV, réglages caméra/nacelle, trajectoires et sécurité, pour intégrer des plans FPV à vos tournages.', 3),
('blackmagic', 'Blackmagic Cinema Camera – Réglages & workflow', 'Débutant à intermédiaire', 'Menus, profils d''image, formats RAW/ProRes, gestion des médias et export : le workflow complet caméra Blackmagic.', 4),
('aputure', 'Éclairage Aputure – Bases de la lumière sur plateau', 'Débutant', 'Placement de sources, températures de couleur, softbox et modificateurs, pour construire une lumière propre rapidement.', 5),
('resolve', 'DaVinci Resolve – Étalonnage niveau 1', 'Débutant à intermédiaire', 'Prise en main de la page Color : roues chromatiques, courbes, nodes, matching de plans et export final.', 6),
('son', 'Prise de son interview – HF, Perches & enregistreurs', 'Débutant', 'Choix du micro selon la situation, réglages de gain, synchro son/image et bonnes pratiques en interview.', 7),
('inspire3', 'DJI Inspire 3 – Prise en main drone cinéma', 'Intermédiaire', 'Configuration double opérateur, réglages caméra, planification de vol et prises de vue cinéma en extérieur.', 8),
('travelling', 'Sliders, Jibs & Dolly Edelkrone', 'Débutant', 'Comparatif et prise en main des solutions Edelkrone : slider motorisé, jib motorisé et dolly motorisé, pour des mouvements de caméra fluides sans gimbal.', 9),
('multicam', 'Multicam & streaming live – Régie légère', 'Intermédiaire', 'Montage d''une régie légère multicaméra pour captation d''évènement et diffusion live : switch, encodage, retours son/image. Blackmagic Caméras, Atem et OBS.', 10)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workshop_sessions_topic_id_fkey'
  ) then
    alter table workshop_sessions
      add constraint workshop_sessions_topic_id_fkey
      foreign key (topic_id) references workshop_topics(id);
  end if;
end $$;

create index if not exists idx_workshop_topics_archived on workshop_topics (archived);

-- ─── 3. Champs détaillés des formations ──────────────────────────────────────

alter table workshop_topics add column if not exists full_description text not null default '';
alter table workshop_topics add column if not exists program text not null default '';
alter table workshop_topics add column if not exists price text not null default '';
alter table workshop_topics add column if not exists duration text not null default '';

-- ─── 4. Catégorie + bonus exclusif ────────────────────────────────────────────

alter table workshop_topics add column if not exists category text not null default '';
alter table workshop_topics add column if not exists bonus text not null default '';

-- ─── 5. Textes éditables de la homepage ──────────────────────────────────────

create table if not exists workshop_site_content (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

insert into workshop_site_content (key, value) values
('price_label', '149 € HT / personne'),
('hero_title', 'Les ateliers du samedi, avec le matériel que vous louez déjà.'),
('hero_lead', 'Une journée 100% pratique (9h–18h) chez Filme à Montreuil, 10 participants maximum, pour prendre en main le matériel avant votre prochain tournage.'),
('pill_capacity', '10 places max par session'),
('pill_audience', 'Réservé aux clients Filme'),
('pill_validation', 'Validée dès 4 inscrits'),
('sessions_heading', 'Sessions ouvertes'),
('sessions_hint', 'Triées de la plus remplie (la plus susceptible d''être programmée) à la moins remplie'),
('topics_heading', 'Les formations'),
('topics_hint', 'Choisissez une formation pour proposer ou rejoindre un ou plusieurs samedis'),
('footer_text', 'Filme — Location de matériel audiovisuel · Montreuil'),
('footer_email', 'location@filme.fr'),
('timeline_step_1', 'Je choisis la formation souhaitée'),
('timeline_step_2', 'Je sélectionne mes disponibilités'),
('timeline_step_3', 'Je suis informé dès qu''une session est confirmée'),
('timeline_step_4', 'Je reçois un message pour confirmer ma participation'),
('engagement_note', 'Les disponibilités sélectionnées constituent un engagement de participation, sauf cas de force majeure. Merci de ne sélectionner que les dates auxquelles vous êtes réellement disponible.')
on conflict (key) do nothing;

insert into workshop_site_content (key, value) values
('cgv_text', $cgv$1. Objet
Les Workshops Filme sont des journées de formation pratique organisées par Filme, destinées à permettre aux participants de découvrir et de maîtriser l'utilisation de matériels audiovisuels professionnels.

2. Préinscription
La sélection d'une ou plusieurs disponibilités constitue une demande de participation ainsi qu'un engagement à être présent sur l'une des dates sélectionnées, sauf cas de force majeure.
Les participants sont invités à ne sélectionner que les dates auxquelles ils sont réellement disponibles.

3. Validation de la session
Une session est organisée dès lors que le nombre minimum de participants est atteint.
Filme contacte alors chaque participant afin de confirmer la date retenue.

4. Confirmation de participation
La participation devient définitive uniquement après :
- la confirmation de la session par Filme ;
- le règlement intégral de la participation via le lien de paiement transmis.

À défaut de paiement dans le délai indiqué, Filme pourra proposer la place à un autre participant.

5. Annulation
En cas d'empêchement, le participant s'engage à prévenir Filme dans les meilleurs délais.
En cas de force majeure dûment justifiée (maladie, accident, décès d'un proche, événement imprévisible empêchant la participation...), Filme pourra proposer un report sur une prochaine session.
En dehors de ces situations, toute annulation après confirmation pourra entraîner l'impossibilité de s'inscrire aux prochaines sessions ou, si le paiement a déjà été effectué, l'application des conditions d'annulation précisées lors de la confirmation.

6. Modification ou annulation par Filme
Filme se réserve le droit de reporter ou d'annuler une session notamment en cas :
- d'un nombre insuffisant de participants ;
- d'une indisponibilité exceptionnelle du formateur ou du matériel ;
- de tout événement indépendant de sa volonté.

Dans ce cas, aucun frais ne sera dû par le participant et les sommes éventuellement versées seront remboursées ou reportées, au choix du participant.

7. Déroulement
Les workshops sont organisés en petits groupes afin de favoriser la pratique.
Chaque participant s'engage à respecter les consignes de sécurité, le matériel mis à disposition ainsi que les autres participants.
Tout comportement mettant en danger les personnes ou le matériel pourra entraîner une exclusion sans remboursement.

8. Droit à l'image
Des photographies ou vidéos pourront être réalisées pendant les workshops afin d'illustrer les activités de Filme.
Les participants pourront s'y opposer en le signalant avant le début de la session.

9. Acceptation
Toute inscription à un Workshop Filme implique l'acceptation des présentes conditions générales.$cgv$)
on conflict (key) do nothing;

-- ─── 6. Samedis fermés aux inscriptions (préférences admin) ──────────────────

create table if not exists workshop_closed_dates (
  date date primary key,
  created_at timestamptz not null default now()
);
