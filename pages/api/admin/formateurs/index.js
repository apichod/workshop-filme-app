import { requireAuth } from '../../../../lib/auth';
import { getAllFormateurs, createFormateur } from '../../../../lib/formateurs';

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
    const { name, email, phone, bio, bioLong, specialties, photoUrl, availability } = req.body || {};
    if (!toText(name)) return res.status(400).json({ error: 'Le nom est requis' });
    if (!toText(email)) return res.status(400).json({ error: "L'email est requis" });
    try {
      const formateur = await createFormateur({
        name: toText(name),
        email: toText(email),
        phone: toText(phone),
        bio: toText(bio),
        bioLong: toText(bioLong),
        specialties: toText(specialties),
        photoUrl: toText(photoUrl),
        availability,
      });
      return res.status(200).json({ formateur });
    } catch (err) {
      console.error('[admin/formateurs POST]', err);
      return res.status(400).json({ error: err.message || 'Erreur serveur' });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
});
