import { requireAuth } from '../../../../lib/auth';
import { reorderSessions } from '../../../../lib/sessions';

// Réorganisation manuelle (glisser-déposer) des sessions ("Événements à
// venir"), mode admin uniquement — reçoit systématiquement la liste complète
// des ids visibles dans leur nouvel ordre (cf. reorderSessions).
export default requireAuth(async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { orderedIds } = req.body || {};
  if (!Array.isArray(orderedIds) || !orderedIds.length) {
    return res.status(400).json({ error: 'orderedIds requis (tableau non vide)' });
  }

  try {
    await reorderSessions(orderedIds);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin/sessions/reorder PATCH]', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});
