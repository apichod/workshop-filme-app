import { requireAuth } from '../../../../lib/auth';
import { updateFormateur, deleteFormateur } from '../../../../lib/formateurs';

export default requireAuth(async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'PATCH') {
    const { name, email, bio, specialties, photoUrl, archived } = req.body || {};
    if (name !== undefined && !name.trim()) return res.status(400).json({ error: 'Le nom est requis' });
    if (email !== undefined && !email.trim()) return res.status(400).json({ error: "L'email est requis" });
    try {
      const formateur = await updateFormateur(id, {
        name: name !== undefined ? name.trim() : undefined,
        email: email !== undefined ? email.trim() : undefined,
        bio: bio !== undefined ? bio.trim() : undefined,
        specialties: specialties !== undefined ? specialties.trim() : undefined,
        photoUrl: photoUrl !== undefined ? photoUrl.trim() : undefined,
        archived: archived !== undefined ? !!archived : undefined,
      });
      if (!formateur) return res.status(404).json({ error: 'Formateur introuvable' });
      return res.status(200).json({ formateur });
    } catch (err) {
      console.error('[admin/formateurs/[id] PATCH]', err);
      return res.status(400).json({ error: err.message || 'Erreur serveur' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const result = await deleteFormateur(id);
      if (!result.ok) {
        if (result.error === 'not_found') return res.status(404).json({ error: 'Formateur introuvable' });
        if (result.error === 'has_topics') return res.status(400).json({ error: 'Des formations sont encore assignées à ce formateur, réassignez-les avant de le supprimer' });
        return res.status(400).json({ error: 'Suppression impossible' });
      }
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[admin/formateurs/[id] DELETE]', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
});
