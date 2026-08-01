import { requireClientAuth } from '../../../../lib/auth';
import { getRegistrationsForEmail } from '../../../../lib/sessions';

export default requireClientAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const registrations = await getRegistrationsForEmail(req.client.email);
    return res.status(200).json({ registrations });
  } catch (err) {
    console.error('[my/registrations GET]', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});
