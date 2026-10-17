# Sadaf 360 — one working project

## Priority implementation — 17 October 2026

Stock and unpaid-invoice snapshot replacements now require every row to pass parsing and reference checks. A failed replacement preserves the old snapshot and invoice headers; non-snapshot files still allow partial loads. Duplicate/ambiguous column matches now block the file, and import results show the exact source-to-field mapping.

Management actions includes a separate customer/product reorder baseline for Private consumables, with at least four distinct order days, typical quantities in ERP units and historical-data coverage. Buying a different product does not reset an item's cycle. Tender, equipment and unclassified accounts are excluded from this first slice. These are unvalidated historical estimates, not trained AI probabilities.

`npm run predictions:evaluate -- docs/prediction-pilot-example.json` runs the offline rolling-window benchmark. The included example is fictional. Real Alpha mapping confirmation, complete exports and accountant reconciliation are still needed; see [the acceptance checklist and pilot instructions](docs/ALPHA_RECONCILIATION.md). The earlier production build failure did not reproduce in the 17 October check: the build completed successfully. Publishing this release through the production Git branch updates the main site; the separate synthetic demo site has its own deployment.

Consolidated 9 October 2026 from the main app project and the separate Desktop CEO dashboard folder.

**Open this folder in Claude Code or Codex for all future Sadaf development:**

`C:\Users\shadi\Desktop\ai app 2026\sadaf-360`

| What you need | Authoritative location | How to use it |
|---|---|---|
| Main application | `src/` and the root `package.json` | Develop the Next.js app here. Configure local environment from `.env.example`, then use `npm run dev`. |
| Current demonstration | [demo/index.html](demo/index.html) | Open this HTML directly for the standalone Basic/Advanced demonstration. Edit its presentation here, not an archived v6 copy. |
| Current input workbook | [docs/Sadaf_inputs_workbook.xlsx](docs/Sadaf_inputs_workbook.xlsx) | The latest nine-sheet v6 workbook, including Accounts. This is the workbook to fill in and maintain. |
| Shared account calculations | `src/core/accounts.ts`, `src/demo/accounts.ts` | Main app account screens and the demo bundle use this shared code. After changes run `npm run demo:build`. |
| Original CEO-folder versions (local only) | `archive/CEO-dashboard-originals-2026-10-09/` | Historical reference only; includes all three HTML versions, both numbered workbooks, and the Word brief. Excluded from Git. |
| Earlier reviews and evidence (local only) | `docs/reviews/` | Historical assessments, validation examples, screenshots and diagnostics. Excluded from Git. |

## What was reconciled

The main repository already contained Claude's account-segmentation work at commit `d2c8311`. CEO `MedTech_Portfolio_360_v6.html` matched `demo/index.html` after excluding the generated account bundle. CEO workbook `(6)` and `docs/Sadaf_inputs_workbook.xlsx` were byte-identical (SHA-256 `72698b02c4273e0815b17502cb024c1c9f327b993a1951df6f452113ea841aee`). No newer content was discarded. On 9 October 2026 `docs/Sadaf_inputs_workbook.xlsx` was updated (new sheet "Imports and predictions", E03/E04 field notes, "Start here" lines 20-21), so it is no longer byte-identical to the archived CEO copy; `docs/` holds the current version.

The canonical demo now recalculates account cards and table totals for searched customers using the shared summary calculation. Its generated bundle has been rebuilt. The corresponding regression check covers one matching account and no matches. Segment-wide context remains labeled separately. Original CEO files are preserved unchanged in the archive.

## Current capability

Both screens show a live current-day clock in Jordan time, a fixed screen-update timestamp, and separate data-integration status. The current screen version is 9 October 2026 at 23:30:00 Jordan time. Its shared timestamp/time-zone configuration is `src/lib/dashboard-status.json`; change `screenUpdatedAt` when releasing a new screen version, then run `npm run demo:build` to synchronize the demo. It is not an ERP refresh timestamp. In the main app the integration label shows the company's latest import that loaded rows (date in Jordan time, file type, snapshot date, and "some rows rejected" for a partial load), or "no imports completed" until one exists. The demo label stays fixed and the synthetic snapshot remains 8 October 2026.

This consolidation gives you one maintained application, one current demo, and one current Excel input specification. The demonstration remains synthetic. The main app can ingest CSV exports of the Alpha ERP files (products, customers, sales and returns, receipts, unpaid invoices, stock by batch, stock transactions, installed equipment) through the owner-only Import data page; XLSX upload and operational manual forms still need implementation. Alpha's real column names are not yet known: header spellings are assumptions in `src/core/import/specs.ts`. Filling the workbook does not update the app automatically.

The main app includes company accounts, signup/login/password-reset infrastructure, calculation modules, and sample account screens. Signed-in company screens read the owner's imported Alpha ERP files: Overview (headline tiles), Finance (`/finance`: sales and margin by line, cash collected, receivables aging), Inventory (`/inventory`: slow stock and estimated expiry loss), Management actions (`/opportunities`: overdue reorders and collections) and Data & update routine (`/weekly`: last 7 days against the 7 before). Every figure names its period or as-of date; missing data shows a dash, never zero. Screens without data say which file to import. The remaining demo screens (Compare versions, Products & suppliers, Finance targets) are listed as "Soon". Guests (open access) still see the synthetic demonstration data on the Overview only.

## Running and checking

Run commands in this project's root folder:

```powershell
npm run dev
```

For a local sample-only session without a company database, use PowerShell:

```powershell
$env:OPEN_ACCESS = 'true'
npm run dev -- --hostname 127.0.0.1 --port 3036
```

After starting that command, open http://127.0.0.1:3036/dashboard. It only shows fictional data. The setting above is for that local process.

For a production build and checks:

```powershell
npm run demo:build
npm test -- --testTimeout=30000
npm run lint
npm run build
npm run typecheck
```

The default development address is `http://localhost:3000/dashboard`. Sample account routes are `/accounts/all`, `/accounts/tender`, and `/accounts/private` for guests; authenticated users can explore `/sample/accounts/all`.

## Existing hosted sites

- Main app: https://medsupply360.netlify.app/dashboard
- Demonstration: https://sadaf-360-demo.netlify.app/

These are the existing production addresses. Consolidating local files does not publish a deployment. Use the local canonical files above for the changes made in this consolidation.

Next milestones: (1) obtain one real Alpha export per file type and adjust the header aliases in `src/core/import/specs.ts` (day-first dates, stock-issue sign and Government/Public to Tender are assumptions); (2) reconcile the screens with the accountant's own reports; (3) Basic and Pro tiers, emailed weekly digest, turning off `OPEN_ACCESS` once the owner login is confirmed.

## Handover verification

- 123 tests passed across ten test files, including the corrected account-search regression.
- Lint and type checks passed.
- Canonical demo browser checks: all 15 Advanced routes, all nine sample CSV validators, three account views, and a 390px mobile overview; no uncaught JavaScript exceptions.
- Local sample main app returned HTTP 200 for `/dashboard` and all three `/accounts/...` routes.
- The active workbook remains byte-identical to the latest CEO workbook (6); no workbook formulas or formatting were changed.
- Production build remains blocked at internal `/_global-error` prerendering with `Cannot read properties of null (reading 'useContext')`. A clean build and detailed debug build reproduced it. Development also reports runtime-prerender warnings around authenticated routes. These issues need resolution before a production release; the successful source checks do not establish deployment readiness. Related Windows reports exist in [the Next.js issue tracker](https://github.com/vercel/next.js/issues/96046), but that does not prove the same root cause here.
- Publishing the source to GitHub and publishing the live sites are separate steps. A connected deployment requires a successful build; verify the hosting status before treating a GitHub push as a live-site update.
