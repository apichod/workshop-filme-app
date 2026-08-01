import { verifyToken, setSessionCookie } from '../../../lib/auth';

export default function handler(req, res) {
  const { token } = req.query;
  const payload = token && verifyToken(token);

  if (!payload?.email) {
    return res.redirect(302, '/admin/login?error=lien-invalide');
  }

  setSessionCookie(res, { email: payload.email });
  return res.redirect(302, '/admin');
}
