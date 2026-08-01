import jwt from 'jsonwebtoken';
import { parse, serialize } from 'cookie';

// Session unique pour tout le monde (clients ET admin) : { email, name, isAdmin }.
// isAdmin distingue les emails listés dans ADMIN_EMAILS des clients Filme
// classiques (vérifiés via Booqable à la connexion, cf. pages/api/login.js).
const SECRET  = process.env.JWT_SECRET;
const COOKIE  = 'workshop_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

export function signToken(payload, expiresIn = MAX_AGE) {
  return jwt.sign(payload, SECRET, { expiresIn });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

export function setSessionCookie(res, payload) {
  const token = signToken(payload, MAX_AGE);
  res.setHeader(
    'Set-Cookie',
    serialize(COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: MAX_AGE,
    })
  );
}

export function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    serialize(COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
  );
}

export function getSession(req) {
  const cookies = parse(req.headers.cookie || '');
  const token = cookies[COOKIE];
  if (!token) return null;
  return verifyToken(token);
}

// Protège une route API réservée à l'admin (ex: /api/admin/*)
export function requireAuth(handler) {
  return (req, res) => {
    const session = getSession(req);
    if (!session?.isAdmin) return res.status(401).json({ error: 'Non authentifié' });
    req.admin = session;
    return handler(req, res);
  };
}

// Protège une page admin (getServerSideProps) — redirige vers /login sinon
export function withAuth(gssp) {
  return async (ctx) => {
    const session = getSession(ctx.req);
    if (!session?.isAdmin) {
      return { redirect: { destination: '/login', permanent: false } };
    }
    ctx.admin = session;
    return gssp(ctx);
  };
}

// Protège une route API réservée à un client connecté, admin ou non
// (ex: /api/my/*)
export function requireClientAuth(handler) {
  return (req, res) => {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Non authentifié' });
    req.client = session;
    return handler(req, res);
  };
}

// Protège une page client (getServerSideProps) — redirige vers /login sinon
export function withClientAuth(gssp) {
  return async (ctx) => {
    const session = getSession(ctx.req);
    if (!session) {
      return { redirect: { destination: '/login', permanent: false } };
    }
    ctx.client = session;
    return gssp(ctx);
  };
}
