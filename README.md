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
- **`lib/topics.js`** — les 10 formations, le tarif (149 € HT), la capacité (6),
  et le calcul des prochains samedis.
- **`lib/sessions.js` / `pages/api/sessions.js`** — liste des sessions à venir
  avec leur taux de remplissage, triées de la plus remplie à la moins remplie.
- **`pages/api/register.js`** — inscription : vérifie le client via Booqable,
  crée la session si besoin, empêche les doublons et le dépassement de 6,
  envoie un email de confirmation, et si la session atteint 6/6 : la marque
  `validated` et envoie l'email "formation validée" à tous les inscrits + à
  `ADMIN_EMAILS`.
- **`pages/index.js`** — la homepage : graph horizontal des sessions (barres,
  triées par probabilité d'être programmées), grille des 10 formations, modale
  d'inscription. Utilise les mêmes classes CSS (`.card`, `.btn`, `.badge`,
  `.modal`, `.form-*`) que le reste du design system Filme.
- **`supabase.sql`** — les 2 tables nécessaires (`workshop_sessions`,
  `workshop_registrations`). Les 10 topics et les samedis restent dans le code
  (`lib/topics.js`), pas besoin de table dédiée pour ça.
- **Build vérifié** (`next build` passe sans erreur).

## Mise en route

```bash
npm install
cp .env.example .env.local   # puis renseigner les vraies valeurs
npm run dev
```

Variables d'environnement (voir `.env.example`) :

- `BOOQABLE_COMPANY_SLUG`, `BOOQABLE_API_KEY` — les mêmes que `portail-filme`.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — projet Supabase existant ou
  nouveau. Coller `supabase.sql` dans l'éditeur SQL Supabase avant le premier
  test (même geste que pour `populate_process_notes.sql` sur filmeai).
- `SMTP_USER`, `SMTP_PASS` — mêmes identifiants Gmail que `portail-filme`.
- `ADMIN_EMAILS` — qui reçoit l'alerte "session validée".

## Déploiement (Vercel)

1. Pousser ce dossier dans un nouveau repo Git (séparé de `portail-filme`, comme demandé).
2. Importer le repo dans Vercel → nouveau projet.
3. Renseigner les variables d'environnement ci-dessus dans Vercel → Settings → Environment Variables.
4. Domaine : Vercel → Settings → Domains → ajouter `workshop.filme.fr`, puis
   créer le CNAME correspondant chez votre registrar DNS (même procédé que pour
   `monespace.filme.fr`).

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
