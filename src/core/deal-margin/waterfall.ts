/**
 * The Deal Margin Waterfall: contract price down to contribution after earned rebates, in accounting order. Every step
 * carries the ids of the ledger entries behind it (so a screen can drill down) and how firm the figure is. `reconcile`
 * proves the waterfall adds up and ties to the ledger within the configured rounding tolerance.
 */
import { sumByLine } from "./ledger";
import { COST_LABEL, COST_CATEGORIES, type MarginPolicy } from "./types";
import type { Basis, DealViews, ViewResult } from "./views";

export type StepKind = "start" | "delta" | "subtotal" | "rebate" | "total";

export interface WaterfallStep {
  key: string;
  label: string;
  kind: StepKind;
  /** Signed fils: costs and discounts are negative, the starting price and rebates positive. For a subtotal, the running total. */
  value: number;
  /** Running total after this step. */
  running: number;
  basis: Basis | "calculated";
  /** Ledger entry ids behind the step. */
  entryIds: string[];
}

export function waterfallOf(v: ViewResult): WaterfallStep[] {
  const steps: WaterfallStep[] = [];
  let running = 0;
  const push = (key: string, label: string, kind: StepKind, value: number, basis: WaterfallStep["basis"], entryIds: string[] = []) => {
    running = kind === "subtotal" || kind === "total" ? running : running + value;
    steps.push({ key, label, kind, value: kind === "subtotal" || kind === "total" ? running : value, running, basis, entryIds });
  };
  push("price", "Contract selling price (excl. VAT)", "start", v.price, v.view === "quoted" ? "quote" : "actual");
  push("discount", "Customer discounts", "delta", -v.discounts, v.discountLine.basis, v.discountLine.ids);
  push("net_revenue", "Net recognised revenue", "subtotal", 0, "calculated");
  for (const c of COST_CATEGORIES) {
    push(c, COST_LABEL[c], "delta", -v.lines[c].fils, v.lines[c].basis, v.lines[c].ids);
    if (c === "other") push("contribution_before", "Contribution profit before rebates", "subtotal", 0, "calculated");
  }
  push("rebates", "Earned supplier rebates (verified only)", "rebate", v.rebates.verified, v.rebates.verified === 0 ? "none" : "actual", v.rebates.ids);
  push("contribution_after", "Contribution after earned rebates", "total", 0, "calculated");
  return steps;
}

export interface Reconciliation {
  ok: boolean;
  /** Fils difference found at each check; all must be within tolerance. */
  checks: { name: string; expected: number; found: number; diff: number; ok: boolean }[];
}

/**
 * Proves the numbers tie out: the last step equals the view's contribution after rebates, the net-revenue and
 * before-rebate subtotals equal their view figures, and the cost lines equal the sum of the counted ledger entries
 * (forecast and realized views only, where the ledger is the source).
 */
export function reconcile(v: ViewResult, views: DealViews | null, policy: Pick<MarginPolicy, "roundingToleranceFils">): Reconciliation {
  const tol = policy.roundingToleranceFils;
  const steps = waterfallOf(v);
  const at = (k: string) => steps.find((s) => s.key === k)!;
  const checks: Reconciliation["checks"] = [];
  const add = (name: string, expected: number, found: number) => checks.push({ name, expected, found, diff: found - expected, ok: Math.abs(found - expected) <= tol });
  add("Net revenue subtotal", v.netRevenue, at("net_revenue").value);
  add("Contribution before rebates subtotal", v.contributionBeforeRebates, at("contribution_before").value);
  add("Final step", v.contributionAfterRebates, at("contribution_after").value);
  if (views && v.view !== "quoted") {
    const sums = sumByLine(views.classified.counted);
    const ledgerCost = COST_CATEGORIES.reduce((s, c) => s + (v.view === "forecast" ? sums[c].actual + sums[c].estimated + sums[c].provision + sums[c].disputed : sums[c].actual + sums[c].provision), 0);
    // Forecast also carries quote figures for lines with no entries; those are not in the ledger, so only compare ledger-backed lines.
    const backed = COST_CATEGORIES.filter((c) => v.lines[c].basis !== "from_quote" && v.lines[c].basis !== "missing" && v.lines[c].basis !== "none").reduce((s, c) => s + v.lines[c].fils, 0);
    add("Cost lines tie to the counted ledger entries", ledgerCost, backed);
  }
  return { ok: checks.every((c) => c.ok), checks };
}
