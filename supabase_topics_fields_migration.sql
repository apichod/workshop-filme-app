-- À coller dans Supabase (projet "workshop-filme") → SQL Editor → Run
-- Ajoute les champs détaillés de chaque formation, en plus de
-- title / level / description déjà existants :
--   - full_description : descriptif complet (affiché en détail public)
--   - program          : programme de la formation (affiché en détail public)
--   - price            : prix spécifique à la formation (sinon prix global affiché)
--   - duration         : durée spécifique à la formation (sinon "1 journée (9h–18h)")
-- Sans risque à ré-exécuter (add column if not exists).

alter table workshop_topics add column if not exists full_description text not null default '';
alter table workshop_topics add column if not exists program text not null default '';
alter table workshop_topics add column if not exists price text not null default '';
alter table workshop_topics add column if not exists duration text not null default '';
