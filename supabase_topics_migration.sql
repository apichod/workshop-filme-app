-- À coller dans Supabase (projet "workshop-filme") → SQL Editor → Run
-- Ajoute la table des formations (éditables depuis /admin/topics) et migre
-- les 10 formations qui étaient codées en dur dans lib/topics.js.

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
('ronin4d', 'Ronin 4D – Prise en main complète', 'Débutant à intermédiaire', 'Prise en main du DJI Ronin 4D : configuration, équilibrage, mise au point, modes de stabilisation, mouvements de caméra, bonnes pratiques de tournage et exercices en conditions réelles. Bon d''achat de 150 € HT sur votre 1ère location Ronin 4D chez Filme (valable 3 mois).', 1),
('rs3pro', 'DJI RS 3 Pro – Stabilisation gimbal caméra', 'Débutant', 'Montage caméra, équilibrage rapide, modes de suivi et mouvements fluides avec le gimbal DJI RS 3 Pro, en conditions réelles de tournage.', 2),
('fpv', 'Drone FPV cinématique – Pilotage & prises de vue', 'Intermédiaire', 'Bases du pilotage FPV, réglages caméra/nacelle, trajectoires et sécurité, pour intégrer des plans FPV à vos tournages.', 3),
('blackmagic', 'Blackmagic Cinema Camera – Réglages & workflow', 'Débutant à intermédiaire', 'Menus, profils d''image, formats RAW/ProRes, gestion des médias et export : le workflow complet caméra Blackmagic.', 4),
('aputure', 'Éclairage Aputure – Bases de la lumière sur plateau', 'Débutant', 'Placement de sources, températures de couleur, softbox et modificateurs, pour construire une lumière propre rapidement.', 5),
('resolve', 'DaVinci Resolve – Étalonnage niveau 1', 'Débutant à intermédiaire', 'Prise en main de la page Color : roues chromatiques, courbes, nodes, matching de plans et export final.', 6),
('son', 'Prise de son plateau – Perches, HF & enregistreurs', 'Débutant', 'Choix du micro selon la situation, réglages de gain, synchro son/image et bonnes pratiques sur plateau.', 7),
('inspire3', 'DJI Inspire 3 – Prise en main drone cinéma', 'Intermédiaire', 'Configuration double opérateur, réglages caméra, planification de vol et prises de vue cinéma en extérieur.', 8),
('travelling', 'Motorisation & travelling – Sliders, dolly, stabilisation', 'Débutant', 'Comparatif et prise en main des solutions mécaniques : slider motorisé, dolly, stabilisateurs, pour des mouvements de caméra fluides sans gimbal.', 9),
('multicam', 'Multicam & streaming live – Régie légère', 'Intermédiaire', 'Montage d''une régie légère multicaméra pour captation d''évènement et diffusion live : switch, encodage, retours son/image.', 10)
on conflict (id) do nothing;

-- Relie workshop_sessions.topic_id à workshop_topics.id : permet à l'admin
-- de récupérer le titre de la formation en une seule requête (jointure).
-- Ignoré si déjà présent (ré-exécution sans risque).
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
