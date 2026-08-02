import { requireAuth } from '../../../../lib/auth';
import { updateTopic, deleteTopic } from '../../../../lib/topics';
import { enforceFixedDateExclusivity } from '../../../../lib/sessions';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default requireAuth(async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'DELETE') {
    try {
      const result = await deleteTopic(id);
      if (!result.ok) {
        if (result.error === 'not_found') return res.status(404).json({ error: 'Formation introuvable' });
        if (result.error === 'not_archived') return res.status(400).json({ error: 'Seule une formation archivée peut être supprimée' });
        if (result.error === 'has_sessions') return res.status(400).json({ error: 'Des sessions existent encore pour cette formation, elle ne peut pas être supprimée' });
        return res.status(400).json({ error: 'Suppression impossible' });
      }
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[admin/topics/[id] DELETE]', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { title, level, desc, fullDescription, program, price, duration, category, type, bonus, maxParticipants, equipment, minParticipants, fixedDate, archived } = req.body || {};
  let parsedMax;
  if (maxParticipants !== undefined) {
    const n = Number.parseInt(maxParticipants, 10);
    parsedMax = Number.isFinite(n) && n > 0 ? n : null;
  }
  let parsedMin;
  if (minParticipants !== undefined) {
    const n = Number.parseInt(minParticipants, 10);
    parsedMin = Number.isFinite(n) && n >= 0 ? n : null;
  }
  let cleanFixedDate;
  if (fixedDate !== undefined) {
    cleanFixedDate = fixedDate && DATE_RE.test(fixedDate) ? fixedDate : null;
  }
  try {
    const topic = await updateTopic(id, {
      title, level, desc, fullDescription, program, price, duration, category, type, bonus,
      maxParticipants: parsedMax,
      equipment,
      minParticipants: parsedMin,
      fixedDate: cleanFixedDate,
      archived,
    });
    if (!topic) return res.status(404).json({ error: 'Formation introuvable' });
    // La date fixe réserve immédiatement sa date : on annule tout autre
    // évènement déjà programmé ce jour-là, sans attendre une inscription.
    if (cleanFixedDate) await enforceFixedDateExclusivity(topic);
    return res.status(200).json({ topic });
  } catch (err) {
    console.error('[admin/topics/[id] PATCH]', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});
