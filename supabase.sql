-- À coller dans Supabase → SQL Editor → Run
-- (même workflow que pour populate_process_notes.sql sur filmeai)

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

-- Les 10 topics et les samedis à venir sont gérés dans le code (lib/topics.js),
-- pas besoin de table dédiée pour ça — seules les sessions réellement ouvertes
-- (au moins 1 inscrit) et les inscriptions vivent en base.
