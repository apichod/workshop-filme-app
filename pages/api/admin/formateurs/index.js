import { requireAuth } from '../../../../lib/auth';
import { getAllFormateurs, createFormateur } from '../../../../lib/formateurs';

export default requireAuth(async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const formateurs = await getAllFormateurs();
      return res.status(200).json({ formateurs });
    } catch (err) {
      console.error('[admin/formateurs GET]', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  if (req.method === 'POST') {
    const { name, email, bio, specialties, photoUrl } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Le nom est requis' });
    if (!email?.trim()) return res.status(400).json({ error: "L'email est requis" });
    try {
      const formateur = await createFormateur({
        name: name.trim(),
        email: email.trim(),
        bio: (bio || '').trim(),
        specialties: (specialties || '').trim(),
        photoUrl: (photoUrl || '').trim(),
      });
      return res.status(200).json({ formateur });
    } catch (err) {
      console.error('[admin/formateurs POST]', err);
      return res.status(400).json({ error: err.message || 'Erreur serveur' });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
});
