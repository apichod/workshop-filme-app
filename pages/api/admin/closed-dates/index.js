import { requireAuth } from '../../../../lib/auth';
import { getClosedDates, setClosedDate } from '../../../../lib/closedDates';

export default requireAuth(async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const dates = await getClosedDates();
      return res.status(200).json({ dates });
    } catch (err) {
      console.error('[admin/closed-dates GET]', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  if (req.method === 'POST') {
    const { date, closed } = req.body || {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
      return res.status(400).json({ error: 'Date invalide' });
    }
    try {
      const result = await setClosedDate(date, !!closed);
      return res.status(200).json(result);
    } catch (err) {
      console.error('[admin/closed-dates POST]', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
});
