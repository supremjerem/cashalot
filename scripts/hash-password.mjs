#!/usr/bin/env node
// Generates a bcrypt hash for APP_PASSWORD_HASH.
// Usage: node scripts/hash-password.mjs "my password"
import bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.mjs "my password"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log(`Hash (for .env, local dev — node --env-file reads it as-is):\n${hash}\n`);
console.log(
  `Hash for docker-compose .env files (compose interpolates $, so every $ must be doubled):\n${hash.replaceAll('$', () => '$$')}`
);
