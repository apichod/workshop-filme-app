-- À coller dans Supabase (projet "workshop-filme") → SQL Editor → Run
-- Ajoute au formateur :
--   - phone       : téléphone de contact (interne, non affiché publiquement).
--   - bio_long    : bio longue, affichée dans la popup "En savoir plus"
--                   (la "bio" courte existante reste affichée sur la carte).
--   - availability : disponibilités hebdomadaires (créneaux horaires précis
--                    par jour), au format
--                    { "lundi": [{"start":"09:00","end":"12:00"}, ...], "mardi": [...], ... }
--                    — usage interne (planification), non affiché publiquement.
-- Sans risque à ré-exécuter.

alter table workshop_formateurs add column if not exists phone text not null default '';
alter table workshop_formateurs add column if not exists bio_long text not null default '';
alter table workshop_formateurs add column if not exists availability jsonb not null default '{}'::jsonb;
