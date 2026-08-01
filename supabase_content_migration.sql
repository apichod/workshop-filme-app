-- À coller dans Supabase (projet "workshop-filme") → SQL Editor → Run
-- Ajoute les textes de la homepage (hors prix/capacité, qui restent dans le
-- code car ils ont un impact sur la logique métier) sous forme clé/valeur,
-- éditables directement depuis la homepage en mode admin.

create table if not exists workshop_site_content (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

insert into workshop_site_content (key, value) values
('price_label', '149 € HT / personne'),
('hero_title', 'Les ateliers du samedi, avec le matériel que vous louez déjà.'),
('hero_lead', 'Une journée 100% pratique (9h–18h) chez Filme à Montreuil, 6 participants maximum, pour prendre en main le matériel avant votre prochain tournage.'),
('pill_capacity', '6 places max par session'),
('pill_audience', 'Réservé aux clients Filme'),
('pill_validation', 'Validée dès 6 inscrits'),
('sessions_heading', 'Sessions ouvertes'),
('sessions_hint', 'Triées de la plus remplie (la plus susceptible d''être programmée) à la moins remplie'),
('topics_heading', 'Les formations'),
('topics_hint', 'Choisissez une formation pour proposer ou rejoindre un ou plusieurs samedis'),
('footer_text', 'Filme — Location de matériel audiovisuel · Montreuil'),
('footer_email', 'location@filme.fr'),
('timeline_step_1', 'Je choisis la formation souhaitée'),
('timeline_step_2', 'Je sélectionne mes disponibilités'),
('timeline_step_3', 'Je suis informé dès qu''une session est confirmée'),
('timeline_step_4', 'Je reçois un message pour confirmer ma participation'),
('engagement_note', 'Les disponibilités sélectionnées constituent un engagement de participation, sauf cas de force majeure. Merci de ne sélectionner que les dates auxquelles vous êtes réellement disponible.')
on conflict (key) do nothing;

-- Le texte des CGU est long et plein d'apostrophes : on utilise le dollar-quoting
-- ($cgv$...$cgv$) pour éviter d'avoir à doubler chaque apostrophe.
insert into workshop_site_content (key, value) values
('cgv_text', $cgv$1. Objet
Les Workshops Filme sont des journées de formation pratique organisées par Filme, destinées à permettre aux participants de découvrir et de maîtriser l'utilisation de matériels audiovisuels professionnels.

2. Préinscription
La sélection d'une ou plusieurs disponibilités constitue une demande de participation ainsi qu'un engagement à être présent sur l'une des dates sélectionnées, sauf cas de force majeure.
Les participants sont invités à ne sélectionner que les dates auxquelles ils sont réellement disponibles.

3. Validation de la session
Une session est organisée dès lors que le nombre minimum de participants est atteint.
Filme contacte alors chaque participant afin de confirmer la date retenue.

4. Confirmation de participation
La participation devient définitive uniquement après :
- la confirmation de la session par Filme ;
- le règlement intégral de la participation via le lien de paiement transmis.

À défaut de paiement dans le délai indiqué, Filme pourra proposer la place à un autre participant.

5. Annulation
En cas d'empêchement, le participant s'engage à prévenir Filme dans les meilleurs délais.
En cas de force majeure dûment justifiée (maladie, accident, décès d'un proche, événement imprévisible empêchant la participation...), Filme pourra proposer un report sur une prochaine session.
En dehors de ces situations, toute annulation après confirmation pourra entraîner l'impossibilité de s'inscrire aux prochaines sessions ou, si le paiement a déjà été effectué, l'application des conditions d'annulation précisées lors de la confirmation.

6. Modification ou annulation par Filme
Filme se réserve le droit de reporter ou d'annuler une session notamment en cas :
- d'un nombre insuffisant de participants ;
- d'une indisponibilité exceptionnelle du formateur ou du matériel ;
- de tout événement indépendant de sa volonté.

Dans ce cas, aucun frais ne sera dû par le participant et les sommes éventuellement versées seront remboursées ou reportées, au choix du participant.

7. Déroulement
Les workshops sont organisés en petits groupes afin de favoriser la pratique.
Chaque participant s'engage à respecter les consignes de sécurité, le matériel mis à disposition ainsi que les autres participants.
Tout comportement mettant en danger les personnes ou le matériel pourra entraîner une exclusion sans remboursement.

8. Droit à l'image
Des photographies ou vidéos pourront être réalisées pendant les workshops afin d'illustrer les activités de Filme.
Les participants pourront s'y opposer en le signalant avant le début de la session.

9. Acceptation
Toute inscription à un Workshop Filme implique l'acceptation des présentes conditions générales.$cgv$)
on conflict (key) do nothing;
