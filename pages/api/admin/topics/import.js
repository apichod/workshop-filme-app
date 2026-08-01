import { requireAuth } from '../../../../lib/auth';
import { importTopic } from '../../../../lib/topics';

// Import JSON en masse : met à jour les formations dont l'id existe déjà,
// crée les autres. Renvoie un résultat par formation, façon "log", pour
// affichage direct dans la popup admin d'export/import.
export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { topics } = req.body || {};
  if (!Array.isArray(topics)) {
    return res.status(400).json({ error: 'Le JSON doit être un tableau de formations ([{...}, {...}])' });
  }

  const results = [];
  for (const t of topics) {
    try {
      const r = await importTopic(t);
      results.push({ id: r.id, title: t?.title, ok: true, action: r.action });
    } catch (err) {
      results.push({ id: t?.id || t?.title || '?', title: t?.title, ok: false, error: err.message || 'Erreur' });
    }
  }

  return res.status(200).json({ results });
});
