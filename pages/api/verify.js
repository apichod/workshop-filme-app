import { verifyToken, setSessionCookie } from '../../lib/auth';

export default function handler(req, res) {
  const { token } = req.query;
  const payload = token && verifyToken(token);

  if (!payload?.email) {
    return res.redirect(302, '/login?error=lien-invalide');
  }

  setSessionCookie(res, {
    email: payload.email,
    name: payload.name || '',
    isAdmin: !!payload.isAdmin,
    isFormateur: !!payload.isFormateur,
    formateurId: payload.formateurId || null,
  });
  const destination = payload.isAdmin ? '/' : payload.isFormateur ? '/formateur' : '/mes-inscriptions';
  return res.redirect(302, destination);
}
