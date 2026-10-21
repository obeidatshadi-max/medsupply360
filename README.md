# Sadaf 360

**Single working project:** see [START_HERE.md](START_HERE.md) for the current demo, Excel workbook, and archived CEO-folder versions. All future Sadaf development belongs in this repository.

Business control tower for a medical equipment / devices / consumables distributor (first customer: Sadaf Medical, Jordan).

- `src/` – Next.js app (multi-tenant: every business table carries `company_id`). Login, session, audit log, login throttle.
- `src/core/calc.ts` – pure calculation core (gross profit, aging, expiry loss, purchase gap, tenders…). Tested against the worked examples in `docs/Sadaf_inputs_workbook.xlsx`. All date logic takes an explicit `asOf`.
- `demo/index.html` – frozen promotional demo with synthetic data. Deployed separately; never served by the app site.
- `docs/` – input workbook (what Alpha ERP must export, what is entered manually).

## Develop

```
cp .env.example .env.local      # set DATABASE_URL and SESSION_SECRET
npm i
npm run db:migrate
COMPANY_SLUG=sadaf COMPANY_NAME="Sadaf Medical" USER_EMAIL=... USER_NAME=... USER_PASSWORD=... npm run user:create
npm run dev
```

Before a PR: `npm run typecheck && npm run lint && npm test && npx next build`.

Schema changes: `npm run db:generate` then `npm run db:netlify-migrations` (mirrors Drizzle SQL into `netlify/database/migrations`).

## Accounts

- `/signup` creates a company and its owner. It is closed unless `SIGNUP_INVITE_CODE` is set; with a code set, the visitor must type it (wrong codes are audited and throttled, 5 per network address per hour, plus honeypot and password policy). Unset the variable to close sign-up again; the login page then hides the link.
- Backups and restore: see `docs/BACKUP_RUNBOOK.md`.
- `/forgot-password` emails a one-time link (valid 60 minutes, only its hash is stored); `/reset-password` sets the new password and signs out every older session.
- Email goes through Brevo: set `BREVO_API_KEY` and `MAIL_SENDER` (a verified sender). Without them the forgot-password page says it is not set up. Links use `APP_URL` (or Netlify's `URL`), never request headers.
- Tests run the real migrations on an in-process Postgres (PGlite): `tests/integration/accounts.test.ts`.

## Tender versus private accounts

- `/accounts/all`, `/accounts/tender`, `/accounts/private` (and `/sample/accounts/...` for signed-in users): every account with YTD sales, gross profit, margin, growth, target, receivables, credit use and a health status with reasons; tender board and win rate on the tender view.
- Calculations live in `src/core/accounts.ts` (rules and ratios) and `src/demo/accounts.ts` (synthetic data through the core). Eight synthetic accounts add up exactly to the company's business-line totals; `src/demo/accounts.test.ts` enforces it.
- The frozen promo demo embeds the same compiled code (`npm run demo:build` after changing `src/core` or `src/demo`); a test fails if the embedded bundle is stale.
- Inputs: `docs/Sadaf_inputs_workbook.xlsx` v6, new sheet `Accounts` (AM6 account master, AM7 targets and last year, AW3 tender detail, AM8 tender results). `scripts/workbook/` rebuilds it and re-checks every formula with an independent engine (`python build_xlsx.py`, `python dump_xlsx.py`, `node eval_xlsx.mjs`; needs `openpyxl` and `hyperformula`).

## Rules

- Never show a figure without its as-of date and source file.
- Estimates (expiry loss, purchase gap, scenarios) are labelled as estimates and never summed with overlapping measures.
- No real client data in `demo/` or in this repo.
