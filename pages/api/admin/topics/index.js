import { requireAuth } from '../../../../lib/auth';
import { getAllTopics, createTopic } from '../../../../lib/topics';
import { enforceFixedDateExclusivity } from '../../../../lib/sessions';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
    const { title, level, desc, fullDescription, program, price, duration, category, type, bonus, maxParticipants, equipment, minParticipants, fixedDate } = req.body || {};
    if (!title?.trim()) return res.status(400).json({ error: 'Le titre est requis' });
    const parsedMax = Number.parseInt(maxParticipants, 10);
    const parsedMin = Number.parseInt(minParticipants, 10);
    const cleanFixedDate = fixedDate && DATE_RE.test(fixedDate) ? fixedDate : null;
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
        minParticipants: Number.isFinite(parsedMin) && parsedMin >= 0 ? parsedMin : null,
        fixedDate: cleanFixedDate,
      });
      if (topic.fixedDate) await enforceFixedDateExclusivity(topic);
      return res.status(200).json({ topic });
    } catch (err) {
      console.error('[admin/topics POST]', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
});
