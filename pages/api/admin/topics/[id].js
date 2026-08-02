import { requireAuth } from '../../../../lib/auth';
import { updateTopic } from '../../../../lib/topics';

export default requireAuth(async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { title, level, desc, fullDescription, program, price, duration, category, type, bonus, maxParticipants, equipment, archived } = req.body || {};
  let parsedMax;
  if (maxParticipants !== undefined) {
    const n = Number.parseInt(maxParticipants, 10);
    parsedMax = Number.isFinite(n) && n > 0 ? n : null;
  }
  try {
    const topic = await updateTopic(id, {
      title, level, desc, fullDescription, program, price, duration, category, type, bonus,
      maxParticipants: parsedMax,
      equipment,
      archived,
    });
    if (!topic) return res.status(404).json({ error: 'Formation introuvable' });
    return res.status(200).json({ topic });
  } catch (err) {
    console.error('[admin/topics/[id] PATCH]', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});
