import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

export async function checkPassword(password) {
  const hash = process.env.APP_PASSWORD_HASH;
  if (!hash) throw new Error('APP_PASSWORD_HASH is not set');
  if (typeof password !== 'string' || !password) return false;
  return bcrypt.compare(password, hash);
}

export function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next();
  res.status(401).json({ error: 'unauthenticated' });
}

// Issues a per-session CSRF token (stored server-side in the signed session
// cookie, never exposed to other origins) that the frontend must echo back
// in the X-CSRF-Token header on state-changing requests.
export function ensureCsrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  next();
}

export function requireCsrfToken(req, res, next) {
  const header = req.get('X-CSRF-Token');
  if (header && req.session?.csrfToken && header === req.session.csrfToken) return next();
  res.status(403).json({ error: 'invalid csrf token' });
}
