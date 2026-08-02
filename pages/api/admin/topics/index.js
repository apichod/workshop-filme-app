import { requireAuth } from '../../../../lib/auth';
import { getAllTopics, createTopic } from '../../../../lib/topics';

export default requireAuth(async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const topics = await getAllTopics();
      return res.status(200).json({ topics });
    } catch (err) {
      console.error('[admin/topics GET]', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  if (req.method === 'POST') {
    const { title, level, desc, fullDescription, program, price, duration, category, type, bonus, maxParticipants, equipment } = req.body || {};
    if (!title?.trim()) return res.status(400).json({ error: 'Le titre est requis' });
    const parsedMax = Number.parseInt(maxParticipants, 10);
    try {
      const topic = await createTopic({
        title: title.trim(),
        level: (level || '').trim(),
        desc: (desc || '').trim(),
        fullDescription: (fullDescription || '').trim(),
        program: (program || '').trim(),
        price: (price || '').trim(),
        duration: (duration || '').trim(),
        category: (category || '').trim(),
        type: (type || '').trim() || 'Formation',
        bonus: (bonus || '').trim(),
        maxParticipants: Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : null,
        equipment: (equipment || '').trim(),
      });
      return res.status(200).json({ topic });
    } catch (err) {
      console.error('[admin/topics POST]', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
});
