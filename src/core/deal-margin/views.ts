/**
 * The three comparable financial states of a deal: Quoted (before the deal), Forecast (latest expectation) and Realized
 * (only what transactions support). All amounts in this file are whole fils; the margin percentages use net recognised
 * revenue as the denominator everywhere.
 */
import { classify, pct, rebateFils, sumByLine, toFils, type Classified, type HeldOut, type LineSums } from "./ledger";
import { COST_CATEGORIES, REBATE_STAGE, type CostCategory, type Deal, type LedgerEntry, type RebateEntry, type RebateStatus } from "./types";

export type ViewName = "quoted" | "forecast" | "realized";
export type Basis = "actual" | "estimated" | "mixed" | "from_quote" | "quote" | "missing" | "none";

export interface LineValue {
  fils: number;
  basis: Basis;
  actual: number;
  /** Estimated (not yet booked) amounts. In the forecast they are counted; in realized they are held out. */
  estimated: number;
  /** Warranty-type provisions: estimates that realized profit counts once the obligation exists. */
  provision: number;
  /** Disputed amounts: counted in the forecast (worst case), held out of realized. */
  disputed: number;
  /** The quote's figure for this line, for comparison. */
  quoted: number;
  ids: string[];
}

export interface RebateSummary {
  /** Fils by current status (each rebate sits in exactly one status). */
  byStatus: Record<RebateStatus, number>;
  /** Earned + accrued + received: the only rebates that may enter verified profit. */
  verified: number;
  /** Contractual only: shown, never added. */
  potential: number;
  /** Received rebates with no supplier credit note or receipt reference. */
  receivedWithoutProof: number;
  ids: string[];
  /** Rebates held out: pending a person's review, rejected, or no exchange rate. */
  heldOut: { rebate: RebateEntry; reason: "pending_review" | "rejected" | "no_fx_rate" | "wrong_deal" }[];
}

export interface Impact {
  /** Estimated amounts that are not yet actual transactions (provisions are reported apart). */
  estimated: number;
  /** Warranty-type provisions: an estimate by nature, so they do not make a deal "incomplete". */
  provisions: number;
  /** Costs the quote expected that have no entry at all. */
  missing: number;
  /** Costs contested with a supplier or customer. */
  disputed: number;
  /** Costs booked but not confirmed as belonging to this deal (pending match, wrong deal). */
  unassigned: number;
}

export type Completeness = "complete" | "partial" | "incomplete";
export type RealizationState = "open" | "provisionally_realized" | "realized";

export interface ViewResult {
  view: ViewName;
  price: number;
  discounts: number;
  netRevenue: number;
  discountLine: LineValue;
  lines: Record<CostCategory, LineValue>;
  grossProfit: number;
  grossMarginPct: number | null;
  /** Every cost except product acquisition. */
  fulfilmentCost: number;
  /** Acquisition + fulfilment. */
  totalCost: number;
  contributionBeforeRebates: number;
  contributionMarginPct: number | null;
  rebates: RebateSummary;
  contributionAfterRebates: number;
  marginAfterRebatesPct: number | null;
  impact: Impact;
  completeness: Completeness;
  /** Only the realized view has a state. */
  state: RealizationState | null;
}

const emptyRebates = (): RebateSummary => ({ byStatus: { contractual: 0, earned: 0, accrued: 0, received: 0 }, verified: 0, potential: 0, receivedWithoutProof: 0, ids: [], heldOut: [] });

function summariseRebates(deal: Deal, rebates: readonly RebateEntry[]): RebateSummary {
  const out = emptyRebates();
  for (const r of rebates) {
    if (r.dealId !== deal.id) {
      out.heldOut.push({ rebate: r, reason: "wrong_deal" });
      continue;
    }
    if (r.review === "rejected") {
      out.heldOut.push({ rebate: r, reason: "rejected" });
      continue;
    }
    if (r.review === "pending") {
      out.heldOut.push({ rebate: r, reason: "pending_review" });
      continue;
    }
    const fils = rebateFils(r);
    if (fils === null) {
      out.heldOut.push({ rebate: r, reason: "no_fx_rate" });
      continue;
    }
    out.byStatus[r.status] += fils;
    out.ids.push(r.id);
    if (r.status === "received" && !r.creditNoteRef) out.receivedWithoutProof += fils;
  }
  out.verified = (Object.keys(out.byStatus) as RebateStatus[]).filter((s) => REBATE_STAGE[s] >= REBATE_STAGE.earned).reduce((s, k) => s + out.byStatus[k], 0);
  out.potential = out.byStatus.contractual;
  return out;
}

const quotedFils = (jod: number) => toFils(jod);

function lineFor(view: ViewName, sums: LineSums, quote: number): LineValue {
  const base = { actual: sums.actual, estimated: sums.estimated, provision: sums.provision, disputed: sums.disputed, quoted: quote, ids: sums.ids };
  if (view === "forecast") {
    if (sums.ids.length > 0) {
      const fils = sums.actual + sums.estimated + sums.provision + sums.disputed;
      const hasOther = sums.estimated + sums.provision + sums.disputed !== 0;
      return { ...base, fils, basis: hasOther ? (sums.actual !== 0 ? "mixed" : "estimated") : "actual" };
    }
    return quote > 0 ? { ...base, fils: quote, basis: "from_quote" } : { ...base, fils: 0, basis: "none" };
  }
  // realized: transactions plus the warranty provision; estimates and disputed amounts wait outside.
  const fils = sums.actual + sums.provision;
  const pending = sums.estimated + sums.disputed;
  if (sums.actual !== 0 && sums.provision !== 0) return { ...base, fils, basis: "mixed" };
  if (sums.provision !== 0) return { ...base, fils, basis: "estimated" };
  if (sums.actual !== 0) return { ...base, fils, basis: "actual" };
  return { ...base, fils: 0, basis: quote > 0 || pending !== 0 ? "missing" : "none" };
}

function assemble(view: ViewName, deal: Deal, discountLine: LineValue, lines: Record<CostCategory, LineValue>, rebates: RebateSummary, rebateFilsToAdd: number, impact: Impact): ViewResult {
  const price = toFils(view === "quoted" ? deal.quote.price : deal.contractPrice);
  const discounts = discountLine.fils;
  const netRevenue = price - discounts;
  const fulfilmentCost = COST_CATEGORIES.filter((c) => c !== "acquisition").reduce((s, c) => s + lines[c].fils, 0);
  const totalCost = lines.acquisition.fils + fulfilmentCost;
  const grossProfit = netRevenue - lines.acquisition.fils;
  const contributionBeforeRebates = netRevenue - totalCost;
  const contributionAfterRebates = contributionBeforeRebates + rebateFilsToAdd;
  const completeness: Completeness = impact.missing > 0 ? "incomplete" : impact.estimated + impact.disputed + impact.unassigned > 0 ? "partial" : "complete";
  return {
    view,
    price,
    discounts,
    netRevenue,
    discountLine,
    lines,
    grossProfit,
    grossMarginPct: pct(grossProfit, netRevenue),
    fulfilmentCost,
    totalCost,
    contributionBeforeRebates,
    contributionMarginPct: pct(contributionBeforeRebates, netRevenue),
    rebates,
    contributionAfterRebates,
    marginAfterRebatesPct: pct(contributionAfterRebates, netRevenue),
    impact,
    completeness,
    state: null,
  };
}

export function quotedView(deal: Deal): ViewResult {
  const q = deal.quote;
  const mk = (jod: number): LineValue => ({ fils: quotedFils(jod), basis: jod > 0 ? "quote" : "none", actual: 0, estimated: 0, provision: 0, disputed: 0, quoted: quotedFils(jod), ids: [] });
  const lines = Object.fromEntries(COST_CATEGORIES.map((c) => [c, mk(q.costs[c])])) as Record<CostCategory, LineValue>;
  const rebates = emptyRebates();
  rebates.byStatus.contractual = quotedFils(q.assumedRebate);
  rebates.potential = rebates.byStatus.contractual;
  // The quote's assumed rebate is an assumption, so it is shown but not added.
  return assemble("quoted", deal, mk(q.discount), lines, rebates, 0, { estimated: 0, provisions: 0, missing: 0, disputed: 0, unassigned: 0 });
}

const sumHeld = (held: readonly HeldOut[], reasons: readonly HeldOut["reason"][]) => held.filter((h) => reasons.includes(h.reason) && h.entry.line !== "discount" && h.fils !== null).reduce((s, h) => s + Math.abs(h.fils ?? 0), 0);

export function stateOf(deal: Deal, impact: Impact): RealizationState {
  const o = deal.obligations;
  const delivered = o.deliveredPct !== null && o.deliveredPct >= 100;
  const installed = !deal.hasInstallation || (o.installedPct !== null && o.installedPct >= 100);
  if (!delivered || !installed) return "open";
  const unresolved = o.receivableOutstanding > 0 || o.warrantyOpen || o.serviceOpen || impact.missing > 0 || impact.estimated > 0 || impact.disputed > 0 || impact.unassigned > 0;
  return unresolved ? "provisionally_realized" : "realized";
}

export interface DealViews {
  quoted: ViewResult;
  forecast: ViewResult;
  realized: ViewResult;
  classified: Classified;
}

/** The three views of a deal from its ledger and rebates. `external` = source keys already counted by other deals. */
export function buildViews(deal: Deal, entries: readonly LedgerEntry[], rebates: readonly RebateEntry[] = [], external: ReadonlySet<string> = new Set()): DealViews {
  const classified = classify(deal, entries, external);
  const sums = sumByLine(classified.counted);
  const rebateSummary = summariseRebates(deal, rebates);
  const unassigned = sumHeld(classified.heldOut, ["pending_review", "wrong_deal"]);

  const make = (view: "forecast" | "realized"): ViewResult => {
    const q = deal.quote;
    const discountLine = lineFor(view, sums.discount, quotedFils(q.discount));
    const lines = Object.fromEntries(COST_CATEGORIES.map((c) => [c, lineFor(view, sums[c], quotedFils(q.costs[c]))])) as Record<CostCategory, LineValue>;
    const all = [...COST_CATEGORIES.map((c) => lines[c])];
    let estimated = 0;
    let provisions = 0;
    let missing = 0;
    let disputed = 0;
    for (const l of all) {
      // Estimates (and warranty provisions) and contested amounts are never actual transactions, so they are reported in
      // both views: counted in the forecast, held out (provisions aside) of realized.
      estimated += l.estimated;
      provisions += l.provision;
      disputed += l.disputed;
      // "Missing" = the quote expected this cost and nothing at all has been recorded for it (not even an estimate).
      if (l.quoted > 0 && l.actual === 0 && l.estimated === 0 && l.provision === 0 && l.disputed === 0) missing += view === "forecast" ? l.fils : l.quoted;
    }
    const impact: Impact = { estimated, provisions, missing, disputed, unassigned };
    const r = assemble(view, deal, discountLine, lines, rebateSummary, rebateSummary.verified, impact);
    return view === "realized" ? { ...r, state: stateOf(deal, impact) } : r;
  };

  return { quoted: quotedView(deal), forecast: make("forecast"), realized: make("realized"), classified };
}
