import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from './app.js';
import { migrate, pool, writeState } from './db.js';
import { seedData } from '../src/logic.js';

const PASSWORD = 'test-password';

beforeAll(async () => {
  process.env.SESSION_SECRET = 'test-secret';
  process.env.APP_PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);
  await migrate();
  await writeState(seedData());
});

afterAll(async () => {
  await pool.end();
});

describe('auth', () => {
  it('rejects unauthenticated access to /api/state', async () => {
    const app = createApp();
    await request(app).get('/api/state').expect(401);
  });

  it('rejects an incorrect password', async () => {
    const app = createApp();
    await request(app).post('/api/login').send({ password: 'wrong' }).expect(401);
  });

  it('logs in with the correct password and grants access to /api/state', async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post('/api/login').send({ password: PASSWORD }).expect(200);
    const res = await agent.get('/api/state').expect(200);
    expect(res.body).toHaveProperty('income');
    expect(res.body).toHaveProperty('recurring');
  });

  it('revokes access after logout', async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post('/api/login').send({ password: PASSWORD }).expect(200);
    await agent.post('/api/logout').expect(200);
    await agent.get('/api/state').expect(401);
  });
});

describe('state persistence', () => {
  it('persists a PUT and returns it on a subsequent GET', async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post('/api/login').send({ password: PASSWORD }).expect(200);

    const updated = {
      ...seedData(),
      income: [{ id: 'a1', label: 'New job', amount: 3000, day: 1 }]
    };
    await agent.put('/api/state').send(updated).expect(200);

    const res = await agent.get('/api/state').expect(200);
    expect(res.body.income).toEqual([{ id: 'a1', label: 'New job', amount: 3000, day: 1 }]);
  });
});
