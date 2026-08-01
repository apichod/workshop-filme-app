-- À coller dans Supabase (projet "workshop-filme") → SQL Editor → Run
-- Ajoute :
--   - category : badge de catégorie (Image / Lumière / Machinerie / Audio / Régie vidéo)
--   - bonus    : "Bonus exclusif" optionnel (ex: "Bon d'achat de 150 € HT sur votre
--                1ère location Ronin 4D chez Filme")
-- Sans risque à ré-exécuter (add column if not exists).

alter table workshop_topics add column if not exists category text not null default '';
alter table workshop_topics add column if not exists bonus text not null default '';
