import { requireAuth } from '../../../../lib/auth';
import { updateTopic } from '../../../../lib/topics';

export default requireAuth(async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { title, level, desc, fullDescription, program, price, duration, archived } = req.body || {};
  try {
    const topic = await updateTopic(id, { title, level, desc, fullDescription, program, price, duration, archived });
    if (!topic) return res.status(404).json({ error: 'Formation introuvable' });
    return res.status(200).json({ topic });
  } catch (err) {
    console.error('[admin/topics/[id] PATCH]', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});
