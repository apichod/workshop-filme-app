-- À coller dans Supabase (projet "workshop-filme") → SQL Editor → Run
-- Fait évoluer le champ "Date fixe" en un vrai sélecteur de planning :
--   - schedule_mode : 'wednesday' | 'friday' | 'saturday' (défaut) | 'fixed'
--     Détermine le jour de la semaine proposé à l'inscription pour cette
--     formation (les prochains mercredis / vendredis / samedis à venir), ou
--     bascule vers la date fixe unique existante (fixed_date, déjà en base).
-- Toutes les formations existantes passent automatiquement à 'saturday'
-- (comportement identique à avant cette migration).
-- Sans risque à ré-exécuter (add column if not exists).

alter table workshop_topics add column if not exists schedule_mode text not null default 'saturday';

update workshop_topics set schedule_mode = 'fixed' where fixed_date is not null and schedule_mode = 'saturday';
