import { requireFormateurAuth } from '../../../lib/auth';
import { getSessionsForFormateur } from '../../../lib/sessions';

export default requireFormateurAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const sessions = await getSessionsForFormateur(req.formateur.formateurId);
    return res.status(200).json({ sessions });
  } catch (err) {
    console.error('[formateur/sessions GET]', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});
