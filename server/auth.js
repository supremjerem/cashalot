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
