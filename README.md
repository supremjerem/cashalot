# Cashalot

![Cashalot dashboard screenshot](screenshot.png)

Personal dashboard for tracking income, expenses, and savings — built to replace a spreadsheet. In-place editing (add/remove/edit rows), live calculations (money left over, smoothing of annual/quarterly charges), and two views (Cards / Compact) over the same data.

## Stack

No build dependency: Vue 3 (Composition API) loaded as an ES module, vendored locally in `vendor/`. The site is 100% static — `index.html` + `src/`.

## Run locally

```bash
npm install   # dev tools (lint, format) only — no runtime dependency
npm run dev   # serves the site at http://localhost:8080
```

Since `app.js` is an ES module, opening `index.html` directly via `file://` won't work: you need a server (`npm run dev`, or any other static server).

## Scripts

| Command                | Effect                              |
| ---------------------- | ----------------------------------- |
| `npm run dev`          | Serves the site locally             |
| `npm run lint`         | ESLint on `src/` and `scripts/`     |
| `npm run format`       | Formats with Prettier               |
| `npm run format:check` | Checks formatting without modifying |
| `npm test`             | Runs the Vitest test suite once     |
| `npm run test:watch`   | Runs Vitest in watch mode           |

## Structure

```
index.html          Structure + Vue template (Cards and Compact views)
src/
  app.js            Vue wiring: reactive state, persistence, animations
  logic.js          Pure business logic (totals, loan progress, state normalization)
  logic.test.js      Vitest unit tests for logic.js
  style.css         Design tokens and styles
vendor/
  vue.esm-browser.prod.js   Vue 3, vendored (no network dependency at runtime)
scripts/
  dev-server.mjs    Small zero-dependency Node static server
.github/
  workflows/        CI (lint/format/test), CodeQL, GitHub Pages deployment
  dependabot.yml    Automated dependency update PRs (npm + GitHub Actions)
```

## Data & privacy

All data (income, expenses, loans, savings...) lives **only in the browser's `localStorage`** — nothing is sent to a server, nothing is committed to the code. The example data seeded in `src/app.js` (`seedData`) is fictional.

`localStorage` is cleared if you clear your browsing data. Use the **Export** / **Import** buttons at the top of the dashboard to back up/restore your data as JSON.

## Roadmap

- [x] Cards and Compact views over the same budget data
- [x] Export / import as JSON
- [x] English-only codebase and docs
- [x] Lint + format checks in CI
- [x] Unit tests for the business logic (totals, loan progress, state normalization)
- [x] CodeQL security scanning + Dependabot dependency updates
- [ ] Component/UI-level tests (Vue Testing Library) for the Cards/Compact views
- [ ] Recurring-charge reminders (e.g. upcoming payment in the next N days)
- [ ] Multi-currency support
