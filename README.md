# Workshop Filme — workshop.filme.fr

Projet Next.js (Pages Router) autonome pour les ateliers du samedi chez Filme —
même stack que `portail-filme` (monespace.filme.fr) : Next.js + Supabase +
Vercel, avec le vrai client Booqable réutilisé tel quel.

Repo volontairement séparé de `portail-filme` (comme demandé), mais construit
pour lui ressembler point par point : mêmes design tokens (`styles/globals.css`
— Open Sans, blanc/bleu, calqué sur location.filme.fr), même façon de vérifier
un client (`lib/booqable.js`, copié de `portail-filme/lib/booqable.js`), même
façon d'envoyer des emails (`lib/mailer.js`, Gmail SMTP via nodemailer).

## Ce qui est fait

- **`lib/booqable.js`** — copie exacte de `getCustomerByEmail()` (v4 + fallback v1,
  avec la vérification stricte de l'email retourné). Un email n'est accepté que
  s'il correspond à un vrai client Booqable Filme.
- **`lib/topics.js`** — le tarif (149 € HT), la capacité (6), le calcul des
  prochains samedis, et les fonctions de lecture/écriture des formations
  (stockées en base, voir plus bas).
- **`lib/sessions.js` / `pages/api/sessions.js`** — liste des sessions à venir
  avec leur taux de remplissage, triées de la plus remplie à la moins remplie.
- **`pages/api/register.js`** — inscription : vérifie le client via Booqable,
  crée la session si besoin, empêche les doublons, le dépassement de 6 et les
  inscriptions sur une formation archivée, envoie un email de confirmation, et
  si la session atteint 6/6 : la marque `validated` et envoie l'email
  "formation validée" à tous les inscrits + à `ADMIN_EMAILS`.
- **`pages/index.js`** — la homepage : graph horizontal des sessions (barres,
  triées par probabilité d'être programmées), grille des formations, modale
  d'inscription avec sélection de **plusieurs samedis à la fois** (une case à
  cocher par samedi). Utilise les mêmes classes CSS (`.card`, `.btn`, `.badge`,
  `.modal`, `.form-*`) que le reste du design system Filme.
- **`supabase.sql`** — les 2 tables de base (`workshop_sessions`,
  `workshop_registrations`).
- **`supabase_topics_migration.sql`** — la table `workshop_topics` (titre,
  niveau, description, `archived`) + migration des 10 formations qui étaient
  codées en dur, + une clé étrangère `workshop_sessions.topic_id → workshop_topics.id`
  pour permettre les jointures admin.
- **`supabase_topics_fields_migration.sql`** — ajoute les champs détaillés de
  chaque formation : `full_description` (descriptif complet), `program`
  (programme), `price` (prix spécifique, sinon le prix global s'applique),
  `duration` (durée spécifique, sinon "1 journée (9h–18h)").
- **`supabase_topics_category_bonus_migration.sql`** — ajoute `category` (badge
  unique parmi Image / Lumière / Machinerie / Audio / Régie vidéo, voir
  `TOPIC_CATEGORIES` dans `lib/topics.js`) et `bonus` (texte libre "Bonus
  exclusif", ex: "Bon d'achat de 150 € HT sur votre 1ère location Ronin 4D
  chez Filme").
- **Admin (`/admin`)** — connexion par lien magique (comme `monespace.filme.fr`),
  réservée aux emails listés dans `ADMIN_EMAILS`. Bandeau fixe en haut avec un
  champ pour rechercher un client par email (affiche son profil Booqable +
  ses inscriptions aux workshops), et un lien vers `/admin/topics`.
- **Édition directement sur la homepage** — connecté en admin, `workshop.filme.fr`
  affiche le bandeau et devient éditable en place :
  - Chaque formation a un bouton ✏️ Éditer qui ouvre une **popup** avec les champs
    Titre, Résumé (pour la carte homepage), Descriptif complet, Programme, Niveau,
    Prix, Durée, Catégorie (badge unique) et Bonus exclusif — ainsi
    qu'Archiver/Désarchiver. Une carte "+ Nouvelle formation" ouvre la même
    popup en mode création.
  - Chaque formation a aussi un lien public **"En savoir plus"** qui ouvre une
    popup (visible par tous les visiteurs) avec le descriptif complet, le
    programme, le niveau, le prix et la durée.
  - Bouton **"⇅ Export / Import JSON"** au-dessus de la grille des formations :
    exporte toutes les formations en JSON (à copier/coller), et permet
    d'importer un tableau JSON (met à jour les formations dont l'`id` existe
    déjà, crée les autres). Le résultat de l'import s'affiche ligne par ligne,
    façon log (`✓ … créée/mise à jour` ou `✗ … erreur`) — voir
    `pages/api/admin/topics/import.js` / `lib/topics.js#importTopic`.
  - Les textes de la page (titre, sous-titre, pastilles hors prix, intitulés de
    section, footer) sont cliquables pour être modifiés — stockés dans
    `workshop_site_content` (`lib/content.js`).
  - Le prix global (149 € HT) et les seuils `CAPACITY` (10, capacité max d'une
    session) / `VALIDATION_THRESHOLD` (4, seuil qui déclenche la validation et
    l'email de confirmation finale) restent dans le code (`lib/topics.js`) car
    ils pilotent la logique métier.
- **`/admin/topics`** — vue alternative dédiée (titre/niveau/description
  uniquement) pour créer/éditer/archiver les formations rapidement ; l'édition
  complète (avec descriptif/programme/prix/durée) se fait via la popup sur la
  homepage.
- **Build vérifié** (`next build` passe sans erreur).

## Mise en route

```bash
npm install
cp .env.example .env.local   # puis renseigner les vraies valeurs
npm run dev
```

Variables d'environnement (voir `.env.example`) :

- `BOOQABLE_COMPANY_SLUG`, `BOOQABLE_API_KEY` — les mêmes que `portail-filme`.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — projet Supabase dédié. Coller
  **dans l'ordre** `supabase.sql`, puis `supabase_topics_migration.sql`, puis
  `supabase_topics_fields_migration.sql`, puis
  `supabase_topics_category_bonus_migration.sql`, puis
  `supabase_content_migration.sql` dans l'éditeur SQL Supabase avant le premier
  test.
- `SMTP_USER`, `SMTP_PASS` — mêmes identifiants Gmail que `portail-filme`
  (mot de passe d'application Google, voir `myaccount.google.com/apppasswords`).
- `ADMIN_EMAILS` — reçoit l'alerte "session validée" ET seul(s) autorisé(s) à
  se connecter sur `/admin`.
- `JWT_SECRET` — secret de session admin (`openssl rand -base64 32`).
- `NEXT_PUBLIC_BASE_URL` — URL publique du site, utilisée dans le lien de
  connexion admin envoyé par email (ex : `https://workshop.filme.fr`).

## Déploiement (Vercel)

1. Pousser ce dossier dans un nouveau repo Git (séparé de `portail-filme`, comme demandé).
2. Importer le repo dans Vercel → nouveau projet.
3. Renseigner les variables d'environnement ci-dessus dans Vercel → Settings → Environment Variables.
4. Domaine : Vercel → Settings → Domains → ajouter `workshop.filme.fr`, puis
   créer le CNAME correspondant chez votre registrar DNS (même procédé que pour
   `monespace.filme.fr`).

## Accès admin

Va sur `/admin/login`, entre un email présent dans `ADMIN_EMAILS`, un lien de
connexion arrive par email (valable 15 min). Une fois connecté :
- `/admin` — recherche un client par email (profil Booqable + ses inscriptions).
- `/admin/topics` — gère les formations (création, édition, archivage).

## Ce qu'il reste à décider / ajuster

- **Réutilisation dans le thème filme.fr (Shopify)** : cette page est un site
  Next.js à part (comme monespace.filme.fr), pas une page Shopify. Le lien
  depuis filme.fr se fait via un lien classique vers `workshop.filme.fr`
  (dans le menu ou le footer du thème Shopify) — il n'y a pas de contrainte
  "widget flottant" ici puisque ce n'est pas le panier Booqable.
- **RGPD** : prévoir une mention de confidentialité si vous voulez aller plus
  loin que le champ email (actuellement seuls nom + email sont stockés).
- **`lib/booqable.js`** a été réduit à `getCustomerByEmail()` uniquement pour
  rester focalisé ; recopiez le fichier source de `portail-filme` si vous
  voulez aussi les fonctions commandes/documents ici.

## Note sur l'ancien prototype

Un premier prototype 100% statique (HTML/localStorage, sans backend) a été
livré avant ce projet — il est maintenant obsolète : il ne partageait pas les
inscriptions entre visiteurs. Ce dossier-ci (`workshop-filme-app`) est la
version à utiliser.
