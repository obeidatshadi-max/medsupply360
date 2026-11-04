/**
 * Deal Profitability & Margin Integrity Engine: shared types.
 *
 * Money rules (one place, used by every file in this folder):
 *  - All reported figures are JOD, VAT-exclusive, held as whole fils (1 JOD = 1000 fils) so sums never drift.
 *  - A foreign-currency entry is converted at the rate recorded WITH the entry (JOD per 1 unit of that currency), then
 *    rounded to the fils. No rate = the entry is held out ("needs rate"), never converted with a guess.
 *  - Every percentage uses NET RECOGNISED REVENUE (contract price minus customer discounts) as its denominator.
 *  - "Contribution profit" is revenue minus the costs attributable to the deal. It is NOT net accounting profit: overhead,
 *    income tax and other accounting adjustments are not included.
 */

export const COST_CATEGORIES = ["acquisition", "freight_customs", "installation", "warranty", "commission", "financing", "other"] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];

export const COST_LABEL: Record<CostCategory, string> = {
  acquisition: "Product acquisition cost",
  freight_customs: "Freight and customs",
  installation: "Installation and commissioning",
  warranty: "Warranty provision",
  commission: "Sales commissions",
  financing: "Financing and collection costs",
  other: "Other fulfilment costs",
};

/** Where an entry lands in the waterfall: the customer discount line, or one of the cost lines. */
export type LedgerLine = "discount" | CostCategory;

/** actual = a posted transaction; estimated = a figure someone expects; disputed = posted but contested (held out of verified profit). */
export type EntryStatus = "actual" | "estimated" | "disputed";

/** How sure we are that the transaction belongs to this deal. exact = matched on a stable identifier. */
export type MatchConfidence = "exact" | "high" | "medium" | "low";

/** A person's decision on a match. `pending` entries are never counted as verified. */
export type ReviewStatus = "confirmed" | "pending" | "rejected";

export interface EntrySource {
  system: string;
  docType: string;
  docNo: string;
  lineNo?: string | null;
}

export interface LedgerEntry {
  id: string;
  dealId: string;
  line: LedgerLine;
  /** In `currency`. Positive = cost or discount; negative = a credit (supplier credit note, reversed discount). */
  amount: number;
  currency: string;
  /** JOD per 1 unit of `currency`. Null for JOD (rate 1) means "not needed"; null for any other currency = missing. */
  fxRate: number | null;
  /** True when `amount` includes VAT at `vatRate` (a fraction, e.g. 0.16). VAT is stripped: it is recoverable, not a cost. */
  vatIncluded: boolean;
  vatRate: number;
  status: EntryStatus;
  /** A warranty provision is an estimate that is part of realized profit once the obligation exists. */
  provision: boolean;
  source: EntrySource | null;
  /** Stable key of the underlying ERP transaction. The same key can be counted once, in one deal. */
  sourceKey: string | null;
  confidence: MatchConfidence;
  review: ReviewStatus;
  /** Set when this cost is already inside another line (e.g. freight inside the landed acquisition cost). It is then held out. */
  coveredBy: CostCategory | null;
  /** The customer or contract reference printed on the transaction, when there is one. */
  customerRef: string | null;
  incurredOn: string | null;
  note: string | null;
}

export type RebateStatus = "contractual" | "earned" | "accrued" | "received";
export const REBATE_STAGE: Record<RebateStatus, number> = { contractual: 0, earned: 1, accrued: 2, received: 3 };
export const REBATE_LABEL: Record<RebateStatus, string> = {
  contractual: "Contractual (promised if targets are met)",
  earned: "Earned (conditions met, not yet booked)",
  accrued: "Accrued (booked, cash not yet received)",
  received: "Received (cash or credit note)",
};

export interface RebateEntry {
  id: string;
  dealId: string;
  supplier: string;
  amount: number;
  currency: string;
  fxRate: number | null;
  status: RebateStatus;
  /** The supplier's rebate agreement or the proof that the condition was met. */
  evidenceRef: string | null;
  /** The supplier credit note or receipt that proves it was received. */
  creditNoteRef: string | null;
  review: ReviewStatus;
}

/** What the quotation or tender price sheet said, before the deal was agreed. All VAT-exclusive JOD. */
export interface Quote {
  price: number;
  discount: number;
  costs: Record<CostCategory, number>;
  /** A rebate the quote counted on. It is shown, never added to verified profit. */
  assumedRebate: number;
}

/** What is still open on the deal. Used to say "provisionally realized" instead of pretending the deal is closed. */
export interface Obligations {
  /** 0-100. Null when unknown (treated as not complete). */
  deliveredPct: number | null;
  /** 0-100, or null when the deal has no installation. */
  installedPct: number | null;
  /** Unpaid invoice value in JOD. */
  receivableOutstanding: number;
  warrantyOpen: boolean;
  serviceOpen: boolean;
}

export type DealKind = "tender" | "private";

export interface Deal {
  id: string;
  kind: DealKind;
  ref: string;
  title: string;
  customerName: string;
  /** Printed customer/contract reference used to catch costs booked against the wrong deal. */
  customerRef: string | null;
  contractPrice: number;
  quote: Quote;
  obligations: Obligations;
  /** Months of warranty promised. Greater than zero and no warranty provision = a finding. */
  warrantyMonths: number;
  /** Whether the deal includes installation. */
  hasInstallation: boolean;
  /** Days the unpaid receivable is overdue (for the financing-cost rule). */
  collectionDaysLate: number;
  /** Synthetic = made up for demonstration; never described as real Alpha data. */
  synthetic: boolean;
}

/** Company-approved thresholds. Every one is null until the company sets it: the engine never invents a margin policy. */
export interface MarginPolicy {
  minContributionMarginPct: number | null;
  maxDiscountPct: number | null;
  /** A cost line may exceed its quote by this many percent before it is called an overrun. Null = any excess counts. */
  costOverrunTolerancePct: number | null;
  /** Forecast margin may fall this many percentage points below the quoted margin. Null = rule is off. */
  deteriorationPp: number | null;
  /** Yearly financing rate used to price delayed collections. Null = the financing rule is off. */
  financingRateAnnualPct: number | null;
  /** Largest gap (in fils) allowed when a waterfall is reconciled to its ledger. */
  roundingToleranceFils: number;
}

export const EMPTY_POLICY: MarginPolicy = {
  minContributionMarginPct: null,
  maxDiscountPct: null,
  costOverrunTolerancePct: null,
  deteriorationPp: null,
  financingRateAnnualPct: null,
  roundingToleranceFils: 1,
};
