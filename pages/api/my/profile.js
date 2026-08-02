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
    // Les custom properties (téléphone, adresse) ne s'écrivent PAS via un
    // objet "properties" imbriqué (lecture seule sur customers — confirmé par
    // l'erreur "data.attributes.properties cannot be written"), mais via
    // "properties_attributes" : un TABLEAU de hashes { identifier, value }
    // (ou champs propres au type "address" : address1/address2/city/country/
    // zipcode), qui crée ou met à jour la valeur de la default property
    // correspondante pour ce client (cf. developers.booqable.com, section
    // "Manage properties through their owner"). Clé du téléphone chez Filme :
    // "telephone" (custom property déjà configurée côté Booqable).
    const propertiesAttributes = [];
    if (phone !== undefined) {
      propertiesAttributes.push({ identifier: 'telephone', value: (phone || '').trim() });
    }
    if (address !== undefined) {
      propertiesAttributes.push({
        identifier: 'main_address',
        address1: (address?.address1 || '').trim(),
        city: (address?.city || '').trim(),
        zipcode: (address?.zipcode || '').trim(),
        country: (address?.country || 'FR').trim(),
      });
    }
    if (propertiesAttributes.length) fields.properties_attributes = propertiesAttributes;
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
