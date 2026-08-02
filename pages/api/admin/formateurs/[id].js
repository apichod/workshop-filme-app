import { requireAuth } from '../../../../lib/auth';
import { updateFormateur, deleteFormateur } from '../../../../lib/formateurs';

// Convertit une valeur quelconque (chaîne, tableau de tags collé par erreur
// via l'import JSON, null…) en texte propre — évite un crash sur .trim()
// quand le JSON importé donne par ex. "specialties": ["Caméra", "Audio"]
// au lieu d'une chaîne "Caméra, Audio".
function toText(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.join(', ').trim();
  return String(v).trim();
}

export default requireAuth(async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'PATCH') {
    const { name, email, phone, bio, bioLong, specialties, photoUrl, availability, archived } = req.body || {};
    if (name !== undefined && !toText(name)) return res.status(400).json({ error: 'Le nom est requis' });
    if (email !== undefined && !toText(email)) return res.status(400).json({ error: "L'email est requis" });
    try {
      const formateur = await updateFormateur(id, {
        name: name !== undefined ? toText(name) : undefined,
        email: email !== undefined ? toText(email) : undefined,
        phone: phone !== undefined ? toText(phone) : undefined,
        bio: bio !== undefined ? toText(bio) : undefined,
        bioLong: bioLong !== undefined ? toText(bioLong) : undefined,
        specialties: specialties !== undefined ? toText(specialties) : undefined,
        photoUrl: photoUrl !== undefined ? toText(photoUrl) : undefined,
        availability,
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
