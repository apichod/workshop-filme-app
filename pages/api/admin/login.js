import { signToken } from '../../../lib/auth';
import { sendAdminMagicLink } from '../../../lib/mailer';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { email } = req.body || {};
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return res.status(400).json({ error: 'Email requis' });

  // Toujours répondre "ok" même si l'email n'est pas admin, pour ne pas
  // révéler quelles adresses ont un accès admin.
  if (!ADMIN_EMAILS.includes(normalized)) {
    console.log('[admin/login] tentative refusée:', normalized);
    return res.status(200).json({ ok: true });
  }

  try {
    const token = signToken({ email: normalized }, '15m');
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://workshop.filme.fr';
    const magicUrl = `${baseUrl}/api/admin/verify?token=${token}`;
    await sendAdminMagicLink(normalized, magicUrl);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin/login]', err);
    return res.status(500).json({ error: "Erreur lors de l'envoi de l'email" });
  }
}
