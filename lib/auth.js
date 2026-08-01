import jwt from 'jsonwebtoken';
import { parse, serialize } from 'cookie';

// Adapté de portail-filme/lib/auth.js — mais ici, la session ne sert
// qu'à l'admin (aucun compte client, l'inscription reste sans login).
const SECRET  = process.env.JWT_SECRET;
const COOKIE  = 'workshop_admin_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 jours

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
  const token = signToken(payload);
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

// Protège une route API — utilisé uniquement pour /api/admin/*
export function requireAuth(handler) {
  return (req, res) => {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Non authentifié' });
    req.admin = session;
    return handler(req, res);
  };
}

// Protège une page (getServerSideProps) — redirige vers /admin/login sinon
export function withAuth(gssp) {
  return async (ctx) => {
    const session = getSession(ctx.req);
    if (!session) {
      return { redirect: { destination: '/admin/login', permanent: false } };
    }
    ctx.admin = session;
    return gssp(ctx);
  };
}
