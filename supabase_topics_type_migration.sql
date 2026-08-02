-- À coller dans Supabase (projet "workshop-filme") → SQL Editor → Run
-- Ajoute :
--   - type : type d'événement affiché en haut de chaque carte formation
--            (Formation / Workshop / Démo / Meetup)
-- Sans risque à ré-exécuter (add column if not exists).

alter table workshop_topics add column if not exists type text not null default 'Formation';
