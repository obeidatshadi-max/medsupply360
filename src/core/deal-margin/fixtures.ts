/**
 * SYNTHETIC deals for tests and the demo. Every customer, supplier, number and document here is made up. Nothing in this
 * file comes from Alpha ERP, and it must never be described as verified real-data integration.
 */
import type { Deal, LedgerEntry, LedgerLine, MarginPolicy, RebateEntry, RebateStatus } from "./types";
import { EMPTY_POLICY } from "./types";

let seq = 0;

export function entry(dealId: string, line: LedgerLine, amount: number, over: Partial<LedgerEntry> = {}): LedgerEntry {
  seq += 1;
  const id = over.id ?? `${dealId}-e${seq}`;
  return {
    id,
    dealId,
    line,
    amount,
    currency: "JOD",
    fxRate: null,
    vatIncluded: false,
    vatRate: 0.16,
    status: "actual",
    provision: false,
    source: { system: "SYNTHETIC-ERP", docType: "doc", docNo: id },
    sourceKey: `SYN:${id}`,
    confidence: "exact",
    review: "confirmed",
    coveredBy: null,
    customerRef: null,
    incurredOn: "2026-06-01",
    note: null,
    ...over,
  };
}

export function rebate(dealId: string, status: RebateStatus, amount: number, over: Partial<RebateEntry> = {}): RebateEntry {
  seq += 1;
  return { id: `${dealId}-r${seq}`, dealId, supplier: "Synthetic Supplier A", amount, currency: "JOD", fxRate: null, status, evidenceRef: null, creditNoteRef: null, review: "confirmed", ...over };
}

const zeroCosts = { acquisition: 0, freight_customs: 0, installation: 0, warranty: 0, commission: 0, financing: 0, other: 0 };

/** The thresholds the synthetic company is pretending to have approved. A real company must enter its own. */
export const SYNTHETIC_POLICY: MarginPolicy = { ...EMPTY_POLICY, minContributionMarginPct: 15, maxDiscountPct: 5, costOverrunTolerancePct: 10, deteriorationPp: 3, financingRateAnnualPct: 9 };

// ── Scenario A: profitable tender, every cost reconciled ──────────────────────────────────────────────────────────────
export const DEAL_A: Deal = {
  id: "A",
  kind: "tender",
  ref: "SYN-T-001",
  title: "Hematology analyser, ministry tender (synthetic)",
  customerName: "Synthetic Ministry Hospital",
  customerRef: "SYN-MOH-1",
  contractPrice: 100000,
  quote: { price: 100000, discount: 2000, costs: { ...zeroCosts, acquisition: 70000, freight_customs: 2500, installation: 3000, warranty: 1500, commission: 1960, financing: 400 }, assumedRebate: 2000 },
  obligations: { deliveredPct: 100, installedPct: 100, receivableOutstanding: 0, warrantyOpen: false, serviceOpen: false },
  warrantyMonths: 12,
  hasInstallation: true,
  collectionDaysLate: 0,
  synthetic: true,
};
export const ENTRIES_A: LedgerEntry[] = [
  entry("A", "discount", 2000),
  entry("A", "acquisition", 40000),
  entry("A", "acquisition", 30000),
  entry("A", "freight_customs", 2500),
  entry("A", "installation", 3000),
  entry("A", "warranty", 1500, { provision: true, status: "estimated" }),
  entry("A", "commission", 1960),
  entry("A", "financing", 400),
];
export const REBATES_A: RebateEntry[] = [rebate("A", "received", 2000, { evidenceRef: "SYN-RA-1", creditNoteRef: "SYN-CN-77" })];

// ── Scenario B: profitable at award, eroding through installation and freight overruns ──────────────────────────────────
export const DEAL_B: Deal = {
  id: "B",
  kind: "tender",
  ref: "SYN-T-002",
  title: "Imaging system, teaching hospital tender (synthetic)",
  customerName: "Synthetic Teaching Hospital",
  customerRef: "SYN-TH-2",
  contractPrice: 200000,
  quote: { price: 200000, discount: 0, costs: { ...zeroCosts, acquisition: 140000, freight_customs: 4000, installation: 6000, warranty: 3000, commission: 4000, financing: 1000 }, assumedRebate: 0 },
  obligations: { deliveredPct: 100, installedPct: 70, receivableOutstanding: 60000, warrantyOpen: true, serviceOpen: false },
  warrantyMonths: 24,
  hasInstallation: true,
  collectionDaysLate: 90,
  synthetic: true,
};
export const ENTRIES_B: LedgerEntry[] = [
  entry("B", "acquisition", 140000),
  entry("B", "freight_customs", 5500),
  entry("B", "freight_customs", 4000, { note: "second shipment, demurrage" }),
  entry("B", "installation", 8000),
  entry("B", "installation", 6000),
  entry("B", "installation", 5000, { status: "estimated", note: "remaining 30% of installation" }),
  entry("B", "warranty", 3000, { provision: true, status: "estimated" }),
  entry("B", "commission", 4000),
  entry("B", "financing", 1000),
];

// ── Scenario C: private-sector deal that only looks profitable (uncertain rebate, missing warranty and installation) ────
export const DEAL_C: Deal = {
  id: "C",
  kind: "private",
  ref: "SYN-P-003",
  title: "Ultrasound unit, private clinic (synthetic)",
  customerName: "Synthetic Private Clinic",
  customerRef: "SYN-PC-3",
  contractPrice: 80000,
  quote: { price: 80000, discount: 0, costs: { ...zeroCosts, acquisition: 55000, freight_customs: 2000, installation: 2500, commission: 1600, financing: 500 }, assumedRebate: 6000 },
  obligations: { deliveredPct: 100, installedPct: 100, receivableOutstanding: 0, warrantyOpen: true, serviceOpen: false },
  warrantyMonths: 24,
  hasInstallation: true,
  collectionDaysLate: 0,
  synthetic: true,
};
export const ENTRIES_C: LedgerEntry[] = [
  entry("C", "acquisition", 55000),
  entry("C", "freight_customs", 2000),
  entry("C", "commission", 1600),
  entry("C", "financing", 500),
  // An installation invoice that matches the customer name only: medium confidence, awaiting a person.
  entry("C", "installation", 2400, { confidence: "medium", review: "pending", note: "customer name matches" }),
];
export const REBATES_C: RebateEntry[] = [rebate("C", "contractual", 6000, { evidenceRef: "SYN-RA-2" }), rebate("C", "received", 1000, { evidenceRef: "SYN-RA-3" })];
