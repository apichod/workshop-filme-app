import { requireClientAuth } from '../../../lib/auth';
import { getCustomerByEmail, getCustomerProfile, updateCustomer } from '../../../lib/booqable';

// Profil Booqable du client connecté — popup "Mon profil" (cf. UserBar).
// Ne concerne que les vrais clients Booqable : un formateur n'a pas de fiche
// Booqable (403 direct), et l'admin (bypass ADMIN_EMAILS) n'en a pas non plus
// sauf coïncidence d'email — dans ce cas 'no_account' est renvoyé proprement
// plutôt qu'une erreur serveur.
export default requireClientAuth(async function handler(req, res) {
  if (req.client.isFormateur) return res.status(403).json({ error: 'no_account' });

  // Le customer id Booqable n'est jamais stocké dans le cookie de session
  // (cf. lib/auth.js) — on le retrouve à chaque appel via l'email, avec la
  // même vérification stricte que getCustomerByEmail (le filtre Booqable
  // peut être ignoré côté API, cf. booqable-client-mechanism.docx §2.1).
  let customer;
  try {
    customer = await getCustomerByEmail(req.client.email);
  } catch (err) {
    console.error('[my/profile] getCustomerByEmail', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
  if (!customer) return res.status(404).json({ error: 'no_account' });

  if (req.method === 'GET') {
    try {
      const profile = await getCustomerProfile(customer.id);
      return res.status(200).json({ profile });
    } catch (err) {
      console.error('[my/profile GET]', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  if (req.method === 'PATCH') {
    const { name, phone, address } = req.body || {};
    const fields = {};
    if (name !== undefined) fields.name = (name || '').trim();
    if (phone !== undefined) fields.phone = (phone || '').trim();
    if (address !== undefined) {
      fields.properties = {
        main_address: {
          street1: (address?.street1 || '').trim(),
          city: (address?.city || '').trim(),
          zipcode: (address?.zipcode || '').trim(),
          country: (address?.country || 'FR').trim(),
        },
      };
    }
    try {
      const profile = await updateCustomer(customer.id, fields);
      return res.status(200).json({ profile });
    } catch (err) {
      console.error('[my/profile PATCH]', err);
      return res.status(500).json({ error: err.message || 'Erreur serveur' });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
});
