import { requireAuth } from '../../../../lib/auth';
import { deleteSessionById } from '../../../../lib/sessions';

// Suppression manuelle d'une session (formation + date) depuis l'admin — ex.
// une date restée programmée alors qu'elle n'est plus liée à la formation
// (ancienne date fixe retirée après coup). Prévient les inscrits concernés
// par email s'il y en a.
export default requireAuth(async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const result = await deleteSessionById(id);
    if (!result.ok) {
      if (result.error === 'not_found') return res.status(404).json({ error: 'Session introuvable' });
      return res.status(400).json({ error: 'Suppression impossible' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin/sessions/[id] DELETE]', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});
