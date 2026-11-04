/**
 * Pre-bid profitability simulation. A pure function of the inputs: it reads nothing, writes nothing and cannot reach the
 * ledger, so a simulation can never overwrite an actual transaction. All figures are VAT-exclusive JOD.
 *
 *   net revenue      R = price x (1 - discount%)
 *   commission       = commission% x R
 *   financing        = R x annual rate% x payment days / 365   (the cost of waiting to be paid)
 *   cost             = supplier + freight/customs + installation + warranty + commission + financing - eligible rebate
 *   contribution     = R - cost       margin = contribution / R
 *
 * Only rebates the user marks as eligible AND earned are subtracted from cost; a promised rebate is shown but not used.
 */
import { fromFils, toFils } from "./ledger";

export interface SimInputs {
  price: number;
  discountPct: number;
  supplierCost: number;
  freightCustoms: number;
  installation: number;
  warrantyProvision: number;
  commissionPct: number;
  paymentDays: number;
  /** Null = no financing assumption given: financing is not priced, and the result says so. */
  financingRateAnnualPct: number | null;
  rebate: number;
  rebateEligibleAndEarned: boolean;
}

export interface SimResult {
  netRevenue: number;
  commission: number;
  financing: number;
  rebateUsed: number;
  totalCost: number;
  contribution: number;
  marginPct: number | null;
  /** Assumptions that were missing or zero and make the result less trustworthy. */
  caveats: string[];
}

export interface SimSensitivity {
  key: keyof SimInputs;
  label: string;
  /** Contribution change for the stated change in the input (+10% of its value, or +1 point for percentage inputs). */
  stepLabel: string;
  contributionDelta: number;
  marginDeltaPp: number | null;
}

export interface SimOutput {
  result: SimResult;
  sensitivities: SimSensitivity[];
  /** Lowest selling price (before discount) that reaches the target margin, or null with `minPriceReason`. */
  minPrice: number | null;
  minPriceReason: string | null;
  /** The target margin used, or null when the company has not set one. */
  targetMarginPct: number | null;
}

const clamp0 = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);

export function simulate(inputs: SimInputs): SimResult {
  const price = toFils(clamp0(inputs.price));
  const R = Math.round(price * (1 - clamp0(inputs.discountPct) / 100));
  const commission = Math.round((R * clamp0(inputs.commissionPct)) / 100);
  const rate = inputs.financingRateAnnualPct;
  const financing = rate === null ? 0 : Math.round((R * clamp0(rate) * clamp0(inputs.paymentDays)) / 100 / 365);
  const rebateUsed = inputs.rebateEligibleAndEarned ? toFils(clamp0(inputs.rebate)) : 0;
  const totalCost = toFils(clamp0(inputs.supplierCost)) + toFils(clamp0(inputs.freightCustoms)) + toFils(clamp0(inputs.installation)) + toFils(clamp0(inputs.warrantyProvision)) + commission + financing - rebateUsed;
  const contribution = R - totalCost;
  const caveats: string[] = [];
  if (rate === null) caveats.push("No yearly rate was given for the cost of waiting for payment, so that cost is not included.");
  if (inputs.installation === 0) caveats.push("Installation cost is zero: confirm that this deal needs no installation.");
  if (inputs.warrantyProvision === 0) caveats.push("Warranty set-aside is zero: confirm that no warranty cost applies.");
  if (inputs.rebate > 0 && !inputs.rebateEligibleAndEarned) caveats.push("The rebate is not counted: it is not marked eligible and earned.");
  return { netRevenue: R, commission, financing, rebateUsed, totalCost, contribution, marginPct: R > 0 ? Math.round((contribution / R) * 1000) / 10 : null, caveats };
}

const STEPS: { key: keyof SimInputs; label: string; pct: boolean }[] = [
  { key: "price", label: "Selling price", pct: false },
  { key: "discountPct", label: "Discount", pct: true },
  { key: "supplierCost", label: "Supplier cost", pct: false },
  { key: "freightCustoms", label: "Freight and customs", pct: false },
  { key: "installation", label: "Installation", pct: false },
  { key: "warrantyProvision", label: "Warranty set-aside", pct: false },
  { key: "commissionPct", label: "Commission", pct: true },
  { key: "paymentDays", label: "Payment terms (days)", pct: false },
  { key: "rebate", label: "Eligible rebate", pct: false },
];

/** Contribution change when each assumption moves against the deal by 10% (percentage inputs by 1 point). */
export function sensitivities(inputs: SimInputs): SimSensitivity[] {
  const base = simulate(inputs);
  return STEPS.map(({ key, label, pct }) => {
    const v = inputs[key] as number;
    // Price and rebate hurt when they fall; every other input hurts when it rises.
    const hurtsWhenLower = key === "price" || key === "rebate";
    const delta = pct ? 1 : v * 0.1 || (key === "paymentDays" ? 10 : 0);
    const moved = { ...inputs, [key]: hurtsWhenLower ? v - delta : v + delta } as SimInputs;
    const r = simulate(moved);
    const d = r.contribution - base.contribution;
    return {
      key,
      label,
      stepLabel: pct ? `${hurtsWhenLower ? "-" : "+"}1 point` : `${hurtsWhenLower ? "-" : "+"}10%`,
      contributionDelta: d,
      marginDeltaPp: r.marginPct === null || base.marginPct === null ? null : Math.round((r.marginPct - base.marginPct) * 10) / 10,
    };
  }).sort((a, b) => a.contributionDelta - b.contributionDelta);
}

/**
 * Minimum selling price for a target margin. Margin is m = 1 - K/R - c - f where K is the fixed costs net of rebate,
 * c the commission share and f the financing share of revenue, so R >= K / (1 - c - f - T) and price = R / (1 - d).
 * Returned only when every cost the formula needs was given (not zero) and the target is reachable.
 */
export function minimumPrice(inputs: SimInputs, targetMarginPct: number | null): { price: number | null; reason: string | null } {
  if (targetMarginPct === null) return { price: null, reason: "The company has not set a minimum margin yet, so there is no target to price against." };
  const missing: string[] = [];
  if (!(inputs.supplierCost > 0)) missing.push("supplier cost");
  if (inputs.installation === 0) missing.push("installation cost (confirm or enter)");
  if (inputs.warrantyProvision === 0) missing.push("warranty set-aside (confirm or enter)");
  if (inputs.financingRateAnnualPct === null) missing.push("yearly rate for the cost of waiting for payment");
  if (missing.length > 0) return { price: null, reason: `The costs entered are not complete enough to give a safe minimum price. Missing: ${missing.join(", ")}.` };
  const c = clamp0(inputs.commissionPct) / 100;
  const f = (clamp0(inputs.financingRateAnnualPct ?? 0) / 100) * (clamp0(inputs.paymentDays) / 365);
  const T = targetMarginPct / 100;
  const denom = 1 - c - f - T;
  if (denom <= 0) return { price: null, reason: "The target margin cannot be reached: commission and the cost of waiting for payment already use up the sales." };
  const K = clamp0(inputs.supplierCost) + clamp0(inputs.freightCustoms) + clamp0(inputs.installation) + clamp0(inputs.warrantyProvision) - (inputs.rebateEligibleAndEarned ? clamp0(inputs.rebate) : 0);
  const R = K / denom;
  const d = clamp0(inputs.discountPct) / 100;
  if (d >= 1) return { price: null, reason: "A discount of 100% or more leaves no revenue." };
  // Round UP to the fils so the minimum price truly reaches the target.
  return { price: Math.ceil(Number(((R / (1 - d)) * 1000).toPrecision(12))) / 1000, reason: null };
}

export function runSimulation(inputs: SimInputs, targetMarginPct: number | null): SimOutput {
  const { price, reason } = minimumPrice(inputs, targetMarginPct);
  return { result: simulate(inputs), sensitivities: sensitivities(inputs), minPrice: price, minPriceReason: reason, targetMarginPct };
}

export const simContributionJod = (r: SimResult) => fromFils(r.contribution);
