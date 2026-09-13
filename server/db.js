import pg from 'pg';
import { seedData } from '../src/logic.js';

const { Pool } = pg;

// Falls back to the local docker-compose.yml Postgres so `npm test` and
// `npm run dev` work out of the box without needing .env for DATABASE_URL.
// Production always sets DATABASE_URL explicitly (docker-compose.prod.yml).
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://cashalot:cashalot@localhost:5435/cashalot'
});

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS budget_state (
      id INTEGER PRIMARY KEY DEFAULT 1,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT budget_state_single_row CHECK (id = 1)
    );
  `);
  await pool.query('INSERT INTO budget_state (id, data) VALUES (1, $1) ON CONFLICT (id) DO NOTHING', [
    JSON.stringify(seedData())
  ]);
}

export async function readState() {
  const { rows } = await pool.query('SELECT data FROM budget_state WHERE id = 1');
  return rows[0]?.data ?? seedData();
}

export async function writeState(data) {
  await pool.query('UPDATE budget_state SET data = $1, updated_at = now() WHERE id = 1', [JSON.stringify(data)]);
}
