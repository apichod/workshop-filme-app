-- À coller dans Supabase (projet "workshop-filme") → SQL Editor → Run
-- Ajoute la table des formateurs et relie chaque formation (workshop_topics)
-- au formateur qui l'anime.
--
--   - workshop_formateurs : fiche formateur (nom, email de connexion, bio,
--                           spécialités, photo). L'email sert de compte de
--                           connexion dédié (même lien magique que l'admin,
--                           cf. lib/auth.js) : un formateur ne voit que les
--                           sessions des formations qui lui sont assignées.
--   - workshop_topics.formateur_id : formateur assigné à la formation.
--
-- Sans risque à ré-exécuter (create if not exists / add column if not exists).

create table if not exists workshop_formateurs (
  id text primary key,
  name text not null,
  email text not null,
  bio text not null default '',
  specialties text not null default '',
  photo_url text not null default '',
  created_at timestamptz not null default now()
);

create unique index if not exists idx_workshop_formateurs_email on workshop_formateurs (lower(email));

alter table workshop_topics add column if not exists formateur_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workshop_topics_formateur_id_fkey'
  ) then
    alter table workshop_topics
      add constraint workshop_topics_formateur_id_fkey
      foreign key (formateur_id) references workshop_formateurs(id);
  end if;
end $$;

create index if not exists idx_workshop_topics_formateur_id on workshop_topics (formateur_id);
