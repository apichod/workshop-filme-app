-- À coller dans Supabase (projet "workshop-filme") → SQL Editor → Run
-- Permet d'assigner PLUSIEURS formateurs à une même formation (jusqu'ici un
-- seul via workshop_topics.formateur_id). Table de liaison many-to-many.
-- L'ancienne colonne workshop_topics.formateur_id est conservée (non
-- supprimée) : elle continue de recevoir le premier formateur assigné, pour
-- compat descendante et comme repli si cette migration n'a pas encore été
-- exécutée (cf. lib/topics.js).
-- Reprend automatiquement l'assignation existante (formateur_id) comme
-- première ligne de liaison pour chaque formation qui en avait un.
-- Sans risque à ré-exécuter.

create table if not exists workshop_topic_formateurs (
  topic_id text not null references workshop_topics(id) on delete cascade,
  formateur_id text not null references workshop_formateurs(id) on delete cascade,
  primary key (topic_id, formateur_id)
);

insert into workshop_topic_formateurs (topic_id, formateur_id)
select id, formateur_id from workshop_topics
where formateur_id is not null
on conflict do nothing;
