import { requireAuth } from '../../../../lib/auth';
import { getRegistrationById, deleteRegistration } from '../../../../lib/sessions';

// Retrait manuel d'un inscrit par l'admin (ex: erreur d'inscription, désistement
// signalé par téléphone…). Voir lib/sessions.js#deleteRegistration pour la
// logique de dévalidation (partagée avec /api/my/registrations/[id].js).
export default requireAuth(async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { id } = req.query;

  try {
    const reg = await getRegistrationById(id);
    if (!reg) return res.status(404).json({ error: 'Inscription introuvable' });

    const remainingCount = await deleteRegistration(reg);
    return res.status(200).json({ ok: true, remainingCount });
  } catch (err) {
    console.error('[admin/registrations DELETE]', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});
