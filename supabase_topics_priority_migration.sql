-- À coller dans Supabase (projet "workshop-filme") → SQL Editor → Run
-- Ajoute :
--   - min_participants : seuil de validation spécifique à la formation
--                        (si NULL, on retombe sur VALIDATION_THRESHOLD global = 4).
--                        0 = priorité totale : dès la 1ère inscription, la
--                        session est validée et annule tout autre évènement
--                        programmé à la même date, même déjà validé.
--   - fixed_date       : date fixe (n'importe quel jour de la semaine) qui
--                        remplace, pour cette formation, la liste des samedis
--                        proposée à l'inscription. Cette date est réservée en
--                        exclusivité dès son enregistrement : elle annule tout
--                        autre évènement déjà programmé ce jour-là et n'est
--                        plus proposable pour aucune autre formation.
-- Sans risque à ré-exécuter (add column if not exists).

alter table workshop_topics add column if not exists min_participants integer;
alter table workshop_topics add column if not exists fixed_date date;

create index if not exists idx_workshop_topics_fixed_date on workshop_topics (fixed_date);
