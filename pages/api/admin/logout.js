import { clearSessionCookie } from '../../../lib/auth';

export default function handler(req, res) {
  clearSessionCookie(res);
  return res.redirect(302, '/admin/login');
}
