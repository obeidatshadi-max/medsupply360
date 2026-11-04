/**
 * Why a margin moved: compares two views line by line. The causes are plain differences between the two views' figures,
 * so they always add up to the change in contribution profit.
 */
import { fromFils, pct } from "./ledger";
import { COST_CATEGORIES, COST_LABEL } from "./types";
import type { ViewResult } from "./views";

export interface VarianceCause {
  key: string;
  label: string;
  /** Effect on contribution profit in fils: negative = profit is lower than in the base view. */
  profitEffect: number;
  baseFils: number;
  compareFils: number;
}

export interface Variance {
  baseView: ViewResult["view"];
  compareView: ViewResult["view"];
  profitChange: number;
  /** Margin change in percentage points of each view's own net revenue (one decimal), or null if either has no revenue. */
  marginChangePp: number | null;
  causes: VarianceCause[];
}

export function variance(base: ViewResult, compare: ViewResult): Variance {
  const causes: VarianceCause[] = [];
  const push = (key: string, label: string, baseFils: number, compareFils: number, sign: 1 | -1) => {
    const effect = sign * (compareFils - baseFils);
    if (effect !== 0) causes.push({ key, label, profitEffect: effect, baseFils, compareFils });
  };
  push("price", "Contract price", base.price, compare.price, 1);
  push("discount", "Customer discounts", base.discounts, compare.discounts, -1);
  for (const c of COST_CATEGORIES) push(c, COST_LABEL[c], base.lines[c].fils, compare.lines[c].fils, -1);
  const profitChange = compare.contributionBeforeRebates - base.contributionBeforeRebates;
  const bm = base.contributionMarginPct;
  const cm = compare.contributionMarginPct;
  return {
    baseView: base.view,
    compareView: compare.view,
    profitChange,
    marginChangePp: bm === null || cm === null ? null : Math.round((cm - bm) * 10) / 10,
    causes: causes.sort((a, b) => a.profitEffect - b.profitEffect),
  };
}

/** One sentence per cause, largest loss first, for the cost variance explanation. */
export function explainVariance(v: Variance): string[] {
  const jod = (f: number) => `JOD ${Math.abs(fromFils(f)).toFixed(3)}`;
  return v.causes.map((c) => `${c.label}: ${c.profitEffect < 0 ? "lowers" : "raises"} profit by ${jod(c.profitEffect)} (${jod(c.baseFils)} → ${jod(c.compareFils)}).`);
}

/** Margin shown without false precision: whole percent, with "about" when the figures are not complete. */
export function displayMargin(marginPct: number | null, completeness: ViewResult["completeness"]): string {
  if (marginPct === null) return "n/a";
  if (completeness === "complete") return `${marginPct.toFixed(1)}%`;
  return `about ${Math.round(marginPct)}%`;
}

export { pct };
