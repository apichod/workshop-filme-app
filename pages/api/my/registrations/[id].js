import { requireClientAuth } from '../../../../lib/auth';
import { getRegistrationById, deleteRegistration } from '../../../../lib/sessions';

// Annulation par le client lui-même : on vérifie que l'inscription lui
// appartient bien avant de la supprimer (l'email de session doit correspondre
// à celui de l'inscription).
export default requireClientAuth(async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { id } = req.query;

  try {
    const reg = await getRegistrationById(id);
    if (!reg) return res.status(404).json({ error: 'Inscription introuvable' });

    if ((reg.email || '').trim().toLowerCase() !== (req.client.email || '').trim().toLowerCase()) {
      return res.status(403).json({ error: "Cette inscription ne vous appartient pas" });
    }

    const remainingCount = await deleteRegistration(reg);
    return res.status(200).json({ ok: true, remainingCount });
  } catch (err) {
    console.error('[my/registrations DELETE]', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});
