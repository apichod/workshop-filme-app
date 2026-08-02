-- À coller dans Supabase (projet "workshop-filme") → SQL Editor → Run
-- Ajoute :
--   - max_participants : nombre de places max spécifique à la formation
--                        (si vide/NULL, on retombe sur CAPACITY global = 10)
--   - equipment        : matériel mis à disposition (affiché dans la popup
--                        "En savoir plus", une ligne par élément)
-- Sans risque à ré-exécuter (add column if not exists).

alter table workshop_topics add column if not exists max_participants integer;
alter table workshop_topics add column if not exists equipment text not null default '';
