import { signToken } from '../../lib/auth';
import { sendMagicLink } from '../../lib/mailer';
import { getCustomerByEmail } from '../../lib/booqable';
import { getFormateurByEmail } from '../../lib/formateurs';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

// Connexion unique pour tout le monde : un email admin (ADMIN_EMAILS) ou
// formateur (table workshop_formateurs) passe directement, un email client
// doit correspondre à un vrai client Booqable (même vérification que le
// formulaire d'inscription).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { email } = req.body || {};
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return res.status(400).json({ error: 'Email requis' });

  try {
    const isAdmin = ADMIN_EMAILS.includes(normalized);
    let name = '';
    let isFormateur = false;
    let formateurId = null;

    if (!isAdmin) {
      const formateur = await getFormateurByEmail(normalized);
      if (formateur) {
        isFormateur = true;
        formateurId = formateur.id;
        name = formateur.name || '';
      } else {
        const customer = await getCustomerByEmail(normalized);
        if (!customer) return res.status(403).json({ error: 'no_account' });
        name = customer.name || '';
      }
    }

    const token = signToken({ email: normalized, name, isAdmin, isFormateur, formateurId }, '15m');
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://workshop.filme.fr';
    const magicUrl = `${baseUrl}/api/verify?token=${token}`;
    await sendMagicLink(normalized, magicUrl);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[api/login]', err);
    return res.status(500).json({ error: "Erreur lors de l'envoi de l'email" });
  }
}
