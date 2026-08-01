-- À coller dans Supabase (projet "workshop-filme") → SQL Editor → Run
-- Table des samedis exclus des inscriptions (fermetures, congés, jours fériés…).
-- La présence d'une date dans cette table = ce samedi n'est pas proposé à
-- l'inscription (ni dans le formulaire, ni côté API si jamais forcé).

create table if not exists workshop_closed_dates (
  date date primary key,
  created_at timestamptz not null default now()
);
