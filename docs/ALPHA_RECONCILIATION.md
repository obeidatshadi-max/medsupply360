# Alpha export acceptance and prediction pilot

Status: real Alpha exports and accountant sign-off are still required. Sample CSVs and passing tests do not confirm Alpha conventions.

## Before company use

For each export, record the Alpha report name/version, export filters, company, reporting period or snapshot date, source row count, currency, pack/unit convention and person confirming totals. Keep the original file unchanged. Run Check file and inspect the matched-column preview; ambiguous source columns are now blocked.

| Export | Confirm against Alpha |
|---|---|
| Products | Exact item code, category, unit/pack conversion, active flag and expiry tracking |
| Customers | Account code and explicit Private/Tender classification; do not assume Government always means Tender |
| Sales/returns | Invoice/line identity, dates and date order, signed quantities/sales/costs, net-of-tax convention and return document type |
| Receipts | Allocation identity, receipt date, invoice linkage, total cash and unallocated amount; avoid counting receipt totals for every allocation |
| Unpaid invoices | Complete same-date snapshot, remaining balances including credits, due dates and overdue buckets |
| Stock by batch | Complete same-date snapshot, ownership, warehouse, batch, expiry, quantity and valuation |
| Stock movements | Actual customer issues/returns; confirm quantity signs and exclude transfers/adjustments from demand |
| Installed equipment | Customer linkage, installed unit identity, active status and compatible consumable mapping |

Compare sales before/after returns, product costs/margins where available, collected cash, unpaid balance, aged balance and owned stock value with the accountant's matching reports. Document every variance and its resolution. Do not change parser aliases or sign rules based only on a synthetic sample.

Stock and unpaid snapshots now reject the whole replacement if any row fails. Other file types still allow partial rows; complete and reconcile sales history before evaluating predictions. A failed snapshot leaves prior snapshot rows and invoice details unchanged. A successful replacement still replaces that date: historical versions of the same date are not retained for rollback.

## First prediction slice

Management actions now shows customer/product reorder estimates for Private consumables with four distinct order days. These use historical median gaps and median quantity per order day in original ERP units. Same-day invoices/lines are combined, and returns are not new orders. Tender, unclassified and non-consumable histories are withheld. Confirm that item codes keep the same unit/pack meaning over time.

The existing customer-level opportunities remain as broader context and are labeled separately. Product estimates are not added to customer opportunities or collections totals. “More regular” describes historical spacing, not a calibrated probability. No trained AI model or validated accuracy is claimed.

## Repeatable evaluation

Run the offline command from the project root:

```powershell
npm run predictions:evaluate -- docs/prediction-pilot-example.json
```

The example is fictional and verifies the pipeline only. For a real run, prepare the same JSON shape with normalized company sales lines, explicit segment/category/unit, completed observation end and rolling cutoffs. Do not mix companies in one input. Keep real customer data outside source control. The command validates input, reads local files only and writes a JSON report to stdout.

Use complete 30-day outcome windows. Prefer non-overlapping cutoffs for a simple pilot; overlapping cutoffs reuse observations and are not independent evidence. Evaluation reports eligible pair/windows, predicted repeats, actual repeats, hits, precision, recall and next-order timing MAE. Null means no denominator, not zero accuracy. Timing MAE covers observed repeat orders only, so assess missed/false alerts alongside it. These are median-cycle baseline results for a future AI candidate to beat.

When available, supply `availableOn` on each row: the date this record version became available. Training excludes later imports at each cutoff. Without it, results are explicitly retrospective. Imported current rows do not recreate overwritten historical versions; point-in-time research needs versioned extracts, saved classifications and historical availability. `observedThrough` is an assertion of complete coverage, not simply the last invoice date. Missing exports and stockouts must be investigated before counting no-order outcomes.

Collect baseline results by product family and customer segment, then benchmark a trained model on identical cutoffs. Do not show numerical AI probabilities until calibration and baseline improvement have been demonstrated on real held-out data. Purchase quantities and stockout predictions additionally need reservations, open purchase orders and actual supplier lead times; these remain later stages.
