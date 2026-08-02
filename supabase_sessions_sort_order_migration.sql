-- À coller dans Supabase (projet "workshop-filme") → SQL Editor → Run
-- Ajoute un ordre d'affichage manuel (glisser-déposer, tri "En vedette") aux
-- sessions ("Événements à venir"), comme pour les formations
-- (workshop_topics.sort_order) et les formateurs (workshop_formateurs.sort_order).
-- Les sessions existantes sont numérotées dans leur ordre actuel (session_date)
-- pour ne pas changer l'affichage au moment de la migration.
-- Sans risque à ré-exécuter.

alter table workshop_sessions add column if not exists sort_order integer;

with numbered as (
  select id, row_number() over (order by session_date asc) - 1 as rn
  from workshop_sessions
  where sort_order is null
)
update workshop_sessions s
set sort_order = numbered.rn
from numbered
where s.id = numbered.id;

alter table workshop_sessions alter column sort_order set default 0;
alter table workshop_sessions alter column sort_order set not null;

create index if not exists workshop_sessions_sort_order_idx on workshop_sessions (sort_order);
