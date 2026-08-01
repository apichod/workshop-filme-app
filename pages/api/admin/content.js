import { requireAuth } from '../../../lib/auth';
import { getSiteContent, updateSiteContentKey } from '../../../lib/content';

export default requireAuth(async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const content = await getSiteContent();
      return res.status(200).json({ content });
    } catch (err) {
      console.error('[admin/content GET]', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  if (req.method === 'PATCH') {
    const { key, value } = req.body || {};
    if (!key) return res.status(400).json({ error: 'Clé requise' });
    try {
      const saved = await updateSiteContentKey(key, value);
      return res.status(200).json({ key, value: saved });
    } catch (err) {
      console.error('[admin/content PATCH]', err);
      return res.status(400).json({ error: err.message || 'Erreur serveur' });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
});
