import { supabaseAdmin } from './supabase';

// Textes de la homepage éditables depuis l'admin (hors prix/capacité, qui
// restent des constantes de code dans lib/topics.js car ils ont un impact
// direct sur la logique métier — le seuil de validation à 6, notamment).
// Valeurs par défaut utilisées tant que la table n'est pas migrée / si une
// clé n'a pas encore de ligne en base.
export const CONTENT_DEFAULTS = {
  price_label: '149 € HT / personne',
  price_label_icon: 'price',
  hero_title: 'Les ateliers du samedi, avec le matériel que vous louez déjà.',
  hero_lead: "Une journée 100% pratique (9h–18h) chez Filme à Montreuil, 10 participants maximum, pour prendre en main le matériel avant votre prochain tournage.",
  pill_capacity: '10 places max par session',
  pill_capacity_icon: 'users',
  pill_audience: 'Réservé aux clients Filme',
  pill_audience_icon: 'shield',
  pill_validation: 'Validée dès 4 inscrits',
  pill_validation_icon: 'check',
  sessions_heading: 'Sessions ouvertes',
  sessions_hint: "Triées de la plus remplie (la plus susceptible d'être programmée) à la moins remplie",
  topics_heading: 'Les formations',
  topics_hint: 'Choisissez une formation pour proposer ou rejoindre un ou plusieurs samedis',
  formateurs_heading: 'Nos formateurs',
  formateurs_hint: 'Les expert·e·s qui animent nos formations et événements',
  footer_text: 'Filme — Location de matériel audiovisuel · Montreuil',
  footer_email: 'location@filme.fr',
  timeline_step_1: 'Je choisis la formation souhaitée',
  timeline_step_2: 'Je sélectionne mes disponibilités',
  timeline_step_3: "Je suis informé dès qu'une session est confirmée",
  timeline_step_4: 'Je reçois un message pour confirmer ma participation',
  engagement_note: "Les disponibilités sélectionnées constituent un engagement de participation. Merci de sélectionner uniquement les dates auxquelles tu es disponible.",
  feature_1_title: 'Groupes réduits',
  feature_1_desc: 'Un suivi personnalisé pour progresser plus vite.',
  feature_2_title: '100% pratique',
  feature_2_desc: 'Du matériel, des exercices concrets et des cas réels.',
  feature_3_title: 'Expertise Filme',
  feature_3_desc: 'Formateurs passionnés, matériel pro et conseils terrain.',
  // Bannière Hero n°2 — Meetups du vendredi.
  hero2_title: 'Les meetups du vendredi, pour rencontrer la communauté audiovisuelle. ✨',
  hero2_lead: "Une soirée conviviale (18h–22h) chez Filme à Montreuil, pour découvrir les dernières nouveautés, échanger avec d'autres professionnels et développer votre réseau autour d'un verre.",
  hero2_bullet_1: '20 places maximum',
  hero2_bullet_1_icon: 'users',
  hero2_bullet_2: 'Démonstration de matériel',
  hero2_bullet_2_icon: 'camera',
  hero2_bullet_3: 'Échanges & networking',
  hero2_bullet_3_icon: 'user',
  hero2_bullet_4: 'Réservé aux clients Filme',
  hero2_bullet_4_icon: 'shield',
  // Bannière Hero n°3 — Démonstrations produits.
  hero3_title: 'Les démonstrations produits, pour découvrir les dernières innovations.',
  hero3_lead: "Une demi-journée, en présence des constructeurs et de leurs équipes, pour tester les nouveautés, assister à des démonstrations exclusives et poser toutes vos questions.",
  hero3_bullet_1: 'Places limitées',
  hero3_bullet_1_icon: 'users',
  hero3_bullet_2: 'Démonstrations en avant-première',
  hero3_bullet_2_icon: 'camera',
  hero3_bullet_3: 'Échanges avec les constructeurs',
  hero3_bullet_3_icon: 'user',
  hero3_bullet_4: 'Réservé aux clients Filme',
  hero3_bullet_4_icon: 'shield',
  // Bannières Hero (carrousel) — liste dynamique éditable depuis l'admin
  // (ajout/suppression de bannières). Stockée en JSON dans cette seule clé
  // (la table workshop_site_content ne stocke que du texte) plutôt qu'en
  // clés séparées hero1/hero2/hero3, pour permettre un nombre variable de
  // bannières. Les clés hero_title/hero2_*/hero3_* ci-dessus sont conservées
  // (valeurs par défaut historiques, reprises ci-dessous) mais ne sont plus
  // utilisées par l'affichage une fois cette clé lue.
  heroes_json: JSON.stringify([
    {
      id: 'hero-1',
      title: 'Les ateliers du samedi, avec le matériel que vous louez déjà.',
      lead: "Une journée 100% pratique (9h–18h) chez Filme à Montreuil, 10 participants maximum, pour prendre en main le matériel avant votre prochain tournage.",
      bullets: [
        { text: '149 € HT / personne', icon: 'price' },
        { text: '10 places max par session', icon: 'users' },
        { text: 'Validée dès 4 inscrits', icon: 'check' },
        { text: 'Réservé aux clients Filme', icon: 'shield' },
      ],
      ctaText: '',
      ctaLink: '',
    },
    {
      id: 'hero-2',
      title: 'Les meetups du vendredi, pour rencontrer la communauté audiovisuelle. ✨',
      lead: "Une soirée conviviale (18h–22h) chez Filme à Montreuil, pour découvrir les dernières nouveautés, échanger avec d'autres professionnels et développer votre réseau autour d'un verre.",
      bullets: [
        { text: '20 places maximum', icon: 'users' },
        { text: 'Démonstration de matériel', icon: 'camera' },
        { text: 'Échanges & networking', icon: 'user' },
        { text: 'Réservé aux clients Filme', icon: 'shield' },
      ],
      ctaText: '',
      ctaLink: '',
    },
    {
      id: 'hero-3',
      title: 'Les démonstrations produits, pour découvrir les dernières innovations.',
      lead: "Une demi-journée, en présence des constructeurs et de leurs équipes, pour tester les nouveautés, assister à des démonstrations exclusives et poser toutes vos questions.",
      bullets: [
        { text: 'Places limitées', icon: 'users' },
        { text: 'Démonstrations en avant-première', icon: 'camera' },
        { text: 'Échanges avec les constructeurs', icon: 'user' },
        { text: 'Réservé aux clients Filme', icon: 'shield' },
      ],
      ctaText: '',
      ctaLink: '',
    },
  ]),
  cgv_text: `1. Objet
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
Toute inscription à un Workshop Filme implique l'acceptation des présentes conditions générales.`,
};

export async function getSiteContent() {
  const { data, error } = await supabaseAdmin.from('workshop_site_content').select('key, value');
  if (error) throw error;
  const map = { ...CONTENT_DEFAULTS };
  (data || []).forEach((row) => { map[row.key] = row.value; });
  return map;
}

export async function updateSiteContentKey(key, value) {
  if (!(key in CONTENT_DEFAULTS)) throw new Error('Clé de contenu inconnue');
  const { data, error } = await supabaseAdmin
    .from('workshop_site_content')
    .upsert({ key, value: value ?? '', updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data.value;
}
