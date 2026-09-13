# Cashalot

![Cashalot dashboard screenshot](screenshot.png)

Personal dashboard for tracking income, expenses, and savings — built to replace a spreadsheet. In-place editing (add/remove/edit rows), live calculations (money left over, smoothing of annual/quarterly charges), and two views (Cards / Compact) over the same data. Every change is saved automatically to a real database — no more manual export/import to move data around.

## Stack

- **Frontend**: Vue 3 (Composition API) loaded as an ES module, vendored locally in `vendor/` — no build step.
- **Backend**: a small Express server (`server/`) that serves the static frontend and a JSON API, backed by PostgreSQL (plain SQL via `pg`, no ORM).
- **Auth**: a single shared password (bcrypt-hashed), protecting the whole app behind a login screen.

## Run locally

1. Start Postgres: `docker compose up -d` (a `cashalot`/`cashalot` database on `localhost:5432`).
2. Copy `.env.example` to `.env` and set `APP_PASSWORD_HASH` — generate one with:
   ```bash
   npm install
   node scripts/hash-password.mjs "your password"
   ```
3. `npm run dev` — serves the app (frontend + API) at http://localhost:3000.

## Scripts

| Command                | Effect                                                   |
| ---------------------- | -------------------------------------------------------- |
| `npm run dev`          | Runs the server (frontend + API) with reload             |
| `npm start`            | Runs the server once, no watch (production)              |
| `npm run lint`         | ESLint on `src/`, `server/` and `scripts/`               |
| `npm run format`       | Formats with Prettier                                    |
| `npm run format:check` | Checks formatting without modifying                      |
| `npm test`             | Runs the Vitest test suite once (needs Postgres running) |
| `npm run test:watch`   | Runs Vitest in watch mode                                |

## Structure

```
index.html          Structure + Vue template (Cards and Compact views)
src/
  app.js            Vue wiring: reactive state, API calls, auth gate, animations
  logic.js          Pure business logic (totals, loan progress, state normalization)
  logic.test.js      Vitest unit tests for logic.js
  style.css         Design tokens and styles
server/
  index.js          Entry point: runs migrations, starts the HTTP server
  app.js            Express app: auth, API routes, static file serving
  db.js             Postgres connection, migration, read/write of the budget state
  auth.js           Password check + session middleware
  app.test.js        Vitest + Supertest integration tests for the API
vendor/
  vue.esm-browser.prod.js   Vue 3, vendored (no network dependency at runtime)
scripts/
  hash-password.mjs Generates a bcrypt hash for APP_PASSWORD_HASH
Dockerfile           Production image (Node + static assets + server)
docker-compose.yml       Local dev stack (Postgres only)
docker-compose.prod.yml  Production stack (app + Postgres, behind Traefik)
.github/
  workflows/        CI (lint/format/test), CodeQL, Docker image publish, VPS deploy
  dependabot.yml    Automated dependency update PRs (npm + Docker + GitHub Actions)
```

## Data & privacy

All data (income, expenses, loans, savings...) lives in a PostgreSQL database on the server — every edit is saved automatically a few hundred milliseconds after you make it. Nothing is committed to the code; the example data seeded on first run (`seedData` in `src/logic.js`) is fictional.

There is no export/import feature — auto-save made it unnecessary. Back up the data with a regular Postgres dump (`pg_dump`) against the `postgres` container if needed.

## Deployment

Deployed via Docker Compose on a personal VPS, behind an existing Traefik reverse proxy, at `cashalot.supremjerem.com`.

- `docker-publish.yml` builds and pushes the image to GHCR after CI passes on `main`.
- `deploy.yml` then SSHes into the server and runs `docker compose -f docker-compose.prod.yml pull && up -d`.
- On the server: copy `.env.prod.example` to `~/apps/live/cashalot/.env` and fill in real values (`POSTGRES_PASSWORD`, `SESSION_SECRET`, `APP_PASSWORD_HASH`).

Required GitHub Actions secrets for the deploy workflow: `SSH_HOST`, `SSH_PORT`, `SSH_USER`, `SSH_PRIVATE_KEY`.

## Roadmap

- [x] Cards and Compact views over the same budget data
- [x] Real backend + PostgreSQL persistence with automatic save
- [x] Password-protected access
- [x] English-only codebase and docs
- [x] Lint + format checks in CI
- [x] Unit and integration tests (business logic + API)
- [x] CodeQL security scanning + Dependabot dependency updates
- [x] Dockerized deployment behind Traefik
- [ ] Component/UI-level tests (Vue Testing Library) for the Cards/Compact views
- [ ] Recurring-charge reminders (e.g. upcoming payment in the next N days)
- [ ] Multi-currency support
