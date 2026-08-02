-- À coller dans Supabase (projet "workshop-filme") → SQL Editor → Run
-- Ajoute un ordre d'affichage manuel (glisser-déposer) aux formateurs,
-- comme pour les formations (workshop_topics.sort_order). Les formateurs
-- existants sont numérotés dans leur ordre actuel (created_at) pour ne pas
-- changer l'affichage au moment de la migration.
-- Sans risque à ré-exécuter.

alter table workshop_formateurs add column if not exists sort_order integer;

with numbered as (
  select id, row_number() over (order by created_at asc) - 1 as rn
  from workshop_formateurs
  where sort_order is null
)
update workshop_formateurs f
set sort_order = numbered.rn
from numbered
where f.id = numbered.id;

alter table workshop_formateurs alter column sort_order set default 0;
alter table workshop_formateurs alter column sort_order set not null;

create index if not exists workshop_formateurs_sort_order_idx on workshop_formateurs (sort_order);
