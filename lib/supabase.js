import { createClient } from '@supabase/supabase-js';

// Client "admin" (service role) — utilisé uniquement côté serveur (routes API,
// getServerSideProps). Ne jamais importer ce fichier dans un composant client.
//
// Fallback vers une URL factice si les variables d'env ne sont pas encore
// définies (ex: build local sans .env) — createClient() lève une exception
// sinon, ce qui casserait `next build`. Les appels réels échoueront proprement
// à l'exécution (catchés dans les routes API) tant que SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY ne sont pas renseignées.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder',
  { auth: { persistSession: false } }
);
