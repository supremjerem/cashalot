import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieSession from 'cookie-session';
import { normalizeState } from '../src/logic.js';
import { readState, writeState } from './db.js';
import { checkPassword, requireAuth } from './auth.js';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(
    cookieSession({
      name: 'cashalot-session',
      keys: [process.env.SESSION_SECRET || 'dev-only-insecure-secret'],
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true
    })
  );

  app.post('/api/login', async (req, res) => {
    const ok = await checkPassword(req.body?.password);
    if (!ok) return res.status(401).json({ error: 'invalid password' });
    req.session.authenticated = true;
    res.json({ authenticated: true });
  });

  app.post('/api/logout', (req, res) => {
    req.session = null;
    res.json({ authenticated: false });
  });

  app.get('/api/session', (req, res) => {
    res.json({ authenticated: Boolean(req.session?.authenticated) });
  });

  app.get('/api/state', requireAuth, async (req, res) => {
    res.json(normalizeState(await readState()));
  });

  app.put('/api/state', requireAuth, async (req, res) => {
    const normalized = normalizeState(req.body);
    await writeState(normalized);
    res.json(normalized);
  });

  app.use('/src', express.static(path.join(rootDir, 'src')));
  app.use('/vendor', express.static(path.join(rootDir, 'vendor')));
  app.get('/favicon.svg', (req, res) => res.sendFile(path.join(rootDir, 'favicon.svg')));
  app.get('/', (req, res) => res.sendFile(path.join(rootDir, 'index.html')));

  return app;
}
