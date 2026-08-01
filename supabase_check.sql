-- À coller dans Supabase → SQL Editor → Run
-- Requête de diagnostic (lecture seule, ne modifie rien) : liste toutes les
-- tables / colonnes / contraintes attendues par le projet et indique si
-- chacune est déjà présente dans la base ("present" = true/false).
-- Si une ligne affiche "false", la migration correspondante n'a pas encore
-- été exécutée (voir supabase_repair_all.sql pour tout corriger d'un coup).

select 'table: workshop_sessions' as item, (to_regclass('public.workshop_sessions') is not null) as present
union all select 'table: workshop_registrations', (to_regclass('public.workshop_registrations') is not null)
union all select 'table: workshop_topics', (to_regclass('public.workshop_topics') is not null)
union all select 'table: workshop_site_content', (to_regclass('public.workshop_site_content') is not null)
union all select 'table: workshop_closed_dates', (to_regclass('public.workshop_closed_dates') is not null)
union all select 'column: workshop_topics.full_description', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'workshop_topics' and column_name = 'full_description')
union all select 'column: workshop_topics.program', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'workshop_topics' and column_name = 'program')
union all select 'column: workshop_topics.price', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'workshop_topics' and column_name = 'price')
union all select 'column: workshop_topics.duration', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'workshop_topics' and column_name = 'duration')
union all select 'column: workshop_topics.category', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'workshop_topics' and column_name = 'category')
union all select 'column: workshop_topics.bonus', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'workshop_topics' and column_name = 'bonus')
union all select 'foreign key: workshop_sessions_topic_id_fkey', exists (select 1 from pg_constraint where conname = 'workshop_sessions_topic_id_fkey')
order by 1;

-- Si toutes les tables ci-dessus existent, vous pouvez aussi lancer ces deux
-- requêtes séparément (chacune échouerait avec une erreur "relation does not
-- exist" si la table correspondante n'existe pas encore, donc à ne lancer
-- qu'après avoir vérifié le résultat ci-dessus) :
--
-- select count(*) as nb_formations from workshop_topics;
-- select count(*) as nb_lignes_contenu from workshop_site_content;
