# Deal Profitability & Margin Integrity Engine

Code: `src/core/deal-margin/` (pure engine, no I/O). Storage: `src/server/services/deal-margin.ts`. Screens: `/deals`, `/deals/[id]`, `/deals/simulate`. Demo mirror: "Deal margins" in `demo/index.html` (`src/demo/deal-margin-screen.ts`).

## Gap analysis (before this work)

| Existed | Missing | Done |
|---|---|---|
| Tenders with bid, award, contract value, deliveries, invoices, guarantees | A cost ledger per deal; any cost other than `sales_lines.product_cost` | `deals`, `deal_cost_entries`, `deal_rebates` |
| Sales lines with product cost and `project_ref` | Freight, installation, warranty, commission, financing, rebates; quoted vs forecast vs realized | Engine + three views |
| ERP import (`import_batches`, specs) | Matching of costs to deals; confidence; review | `match.ts`, review queue, `importCostsAction` (own file path, see limits) |
| Management actions tracker | Link finding → action → verified outcome | `deal_action_outcomes`, `outcome.ts` |
| No AI anywhere | AI explanation | Templated explanations only (`explain.ts`); no model is called |

## Formulas (all VAT-exclusive JOD, whole fils inside)

- Entry fils = (amount ÷ (1+VAT) if VAT-included) × rate (JOD = 1), rounded half away from zero. No rate = held out.
- Net revenue R = contract price − customer discounts (credit notes are negative discounts).
- Gross profit = R − acquisition. Fulfilment cost = every cost except acquisition. Total cost = both.
- Contribution before rebates = R − total cost. Contribution after = + verified rebates.
- Every percentage is divided by R.
- Verified rebates = earned + accrued + received. Contractual is shown, never added.
- Forecast line = actual + estimate + provision + disputed; a line with no entry falls back to the quote and is labelled "From quote: nothing recorded".
- Realized line = actual + warranty provision only. Estimates and disputes are listed as impact, not counted.
- Realized state: open (delivery/installation < 100% or unknown) → provisionally realized (money, warranty, service or cost still open) → realized.
- Late-collection financing = outstanding × yearly rate × days late ÷ 365 (only when the company set a rate).
- Simulator: margin = 1 − K/R − commission% − financing%; minimum price = K ÷ (1 − c − f − target) ÷ (1 − discount), rounded up to the fils, only when every cost input is entered.

## Rules that never fire without a company threshold

Minimum margin, maximum discount, allowed margin fall, financing rate. `margin_policies` is empty until the owner fills it. Cost overrun tolerance empty = any excess counts.

## Counting rules

A ledger entry is held out (and listed with the reason) when: wrong deal or customer reference; rejected; pending review with less than exact match; no exchange rate; already inside another line; duplicate (same source key or same document line). The database also enforces one source key per company. Profit at risk adds root-cause findings only (not deterioration, below-minimum or duplicate).

## Status

| | Implemented | Tested | Synthetic demo | Real Alpha data |
|---|---|---|---|---|
| Engine, waterfall, views, findings, simulator, matching, outcomes | yes | 74 unit tests | yes (Scenarios A/B/C) | no |
| Tables, service, tenant isolation, idempotent import | yes | 16 integration tests (PGlite, real migrations) | n/a | no |
| Screens `/deals*`, demo screen | yes | compile + demo render test; demo clicked in browser | yes | no |
| Signed-in app screens | yes | **not clicked through** | n/a | no |

## Known limits

- No real Alpha export has been seen. Cost-file column names are assumptions. Costs enter by the deal cost file or by hand; the file is not yet a registered import kind in `import_batches`.
- Warranty provision rates, installation standard costs and commission rules are not derived: the owner or the ERP supplies them.
- Foreign-currency rates are typed per entry; no rate table.
- Outcome checks run when the owner presses "Recalculate"; there is no scheduler.
- Role model: the owner and finance keep the data (deals, costs, rebates, cost file, confirm or reject matches); only the owner sets the company limits and starts or checks actions; the owner, administrators and finance read and simulate. Finance sees no other business screen.
