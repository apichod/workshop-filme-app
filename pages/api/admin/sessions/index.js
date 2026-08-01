import { requireAuth } from '../../../../lib/auth';
import { getSessionsWithRegistrantsAdmin } from '../../../../lib/sessions';

// Liste les sessions à venir ayant au moins un inscrit, avec le détail des
// inscrits — utilisé par la popup admin "Préférences → Inscriptions" pour
// permettre le retrait manuel d'un inscrit.
export default requireAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const sessions = await getSessionsWithRegistrantsAdmin();
    return res.status(200).json({ sessions });
  } catch (err) {
    console.error('[admin/sessions GET]', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});
