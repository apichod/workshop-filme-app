-- À coller dans Supabase (projet "workshop-filme") → SQL Editor → Run
-- Ajoute la possibilité d'archiver un formateur (masqué de la section publique
-- "Nos formateurs", mais toujours visible côté admin — même logique que
-- workshop_topics.archived). Sans risque à ré-exécuter.

alter table workshop_formateurs add column if not exists archived boolean not null default false;

create index if not exists idx_workshop_formateurs_archived on workshop_formateurs (archived);
