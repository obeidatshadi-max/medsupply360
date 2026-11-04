/**
 * Reconciliation: tying ERP transactions to deals without guessing.
 *
 *  exact   a stable identifier (contract, tender, project, invoice, serial or purchase-order number) equals exactly one deal.
 *  high    two independent weaker signals agree (the customer reference AND a date inside the deal's window).
 *  medium  one weak signal (customer reference, or the customer name).
 *  low     nothing reliable, or the identifiers point to more than one deal.
 *
 * Only `exact` is counted without a person's decision. Everything else is a SUGGESTION for human review: the matcher never
 * silently assigns an uncertain transaction to a deal.
 */
import type { LedgerEntry, LedgerLine, MatchConfidence, ReviewStatus } from "./types";

export interface DealIdentifiers {
  dealId: string;
  contractNo: string | null;
  tenderNo: string | null;
  projectRefs: string[];
  invoiceNos: string[];
  serials: string[];
  poNos: string[];
  customerRef: string | null;
  customerName: string;
  /** Inclusive ISO dates of the deal's life, used as one weak signal. */
  windowStart: string | null;
  windowEnd: string | null;
}

export interface ErpTransaction {
  sourceKey: string;
  system: string;
  docType: string;
  docNo: string;
  lineNo: string | null;
  line: LedgerLine;
  amount: number;
  currency: string;
  fxRate: number | null;
  vatIncluded: boolean;
  vatRate: number;
  date: string | null;
  contractNo: string | null;
  tenderNo: string | null;
  projectRef: string | null;
  invoiceNo: string | null;
  serial: string | null;
  poNo: string | null;
  customerRef: string | null;
  customerName: string | null;
}

export interface MatchResult {
  dealId: string | null;
  confidence: MatchConfidence;
  /** Plain reasons, so a reviewer sees why. */
  reasons: string[];
  /** Every deal the transaction could belong to. More than one = ambiguous. */
  candidates: string[];
}

const norm = (s: string | null | undefined) => (s ?? "").normalize("NFKC").toLowerCase().replace(/[\s\-_/.]+/g, "");

export function matchTransaction(txn: ErpTransaction, deals: readonly DealIdentifiers[]): MatchResult {
  const stable: [string, string | null, (d: DealIdentifiers) => (string | null)[]][] = [
    ["contract number", txn.contractNo, (d) => [d.contractNo]],
    ["tender number", txn.tenderNo, (d) => [d.tenderNo]],
    ["project reference", txn.projectRef, (d) => d.projectRefs],
    ["invoice number", txn.invoiceNo, (d) => d.invoiceNos],
    ["serial number", txn.serial, (d) => d.serials],
    ["purchase order", txn.poNo, (d) => d.poNos],
  ];
  const exactHits = new Map<string, string[]>();
  for (const d of deals) {
    for (const [label, value, pick] of stable) {
      if (norm(value) === "") continue;
      if (pick(d).some((x) => norm(x) === norm(value))) exactHits.set(d.dealId, [...(exactHits.get(d.dealId) ?? []), `${label} ${value} matches`]);
    }
  }
  if (exactHits.size === 1) {
    const [dealId, reasons] = [...exactHits.entries()][0];
    return { dealId, confidence: "exact", reasons, candidates: [dealId] };
  }
  if (exactHits.size > 1) return { dealId: null, confidence: "low", reasons: ["identifiers point to more than one deal"], candidates: [...exactHits.keys()].sort() };

  const scored: { id: string; signals: string[] }[] = [];
  for (const d of deals) {
    const signals: string[] = [];
    if (norm(txn.customerRef) !== "" && norm(txn.customerRef) === norm(d.customerRef)) signals.push("customer reference matches");
    else if (norm(txn.customerName) !== "" && norm(txn.customerName) === norm(d.customerName)) signals.push("customer name matches");
    if (txn.date && d.windowStart && d.windowEnd && txn.date >= d.windowStart && txn.date <= d.windowEnd && signals.length > 0) signals.push("date inside the deal period");
    if (signals.length > 0) scored.push({ id: d.dealId, signals });
  }
  if (scored.length === 0) return { dealId: null, confidence: "low", reasons: ["no identifier or customer matches"], candidates: [] };
  scored.sort((a, b) => b.signals.length - a.signals.length || a.id.localeCompare(b.id));
  const best = scored[0];
  const tie = scored.length > 1 && scored[1].signals.length === best.signals.length;
  if (tie) return { dealId: null, confidence: "low", reasons: ["more than one deal fits equally"], candidates: scored.map((s) => s.id).sort() };
  return { dealId: best.id, confidence: best.signals.length >= 2 ? "high" : "medium", reasons: best.signals, candidates: scored.map((s) => s.id) };
}

/** A ledger entry from a transaction and its match. Unmatched transactions get no deal and stay out of every deal's ledger. */
export function toLedgerEntry(txn: ErpTransaction, match: MatchResult, estimated = false): LedgerEntry | null {
  if (match.dealId === null) return null;
  const review: ReviewStatus = match.confidence === "exact" ? "confirmed" : "pending";
  return {
    id: `erp:${txn.sourceKey}`,
    dealId: match.dealId,
    line: txn.line,
    amount: txn.amount,
    currency: txn.currency,
    fxRate: txn.fxRate,
    vatIncluded: txn.vatIncluded,
    vatRate: txn.vatRate,
    status: estimated ? "estimated" : "actual",
    provision: false,
    source: { system: txn.system, docType: txn.docType, docNo: txn.docNo, lineNo: txn.lineNo },
    sourceKey: txn.sourceKey,
    confidence: match.confidence,
    review,
    coveredBy: null,
    customerRef: txn.customerRef,
    incurredOn: txn.date,
    note: match.reasons.join("; "),
  };
}

export interface MergeResult {
  entries: LedgerEntry[];
  inserted: number;
  updated: number;
  unchanged: number;
  /** Existing entries a person already decided (confirmed/rejected): the re-import changes their figures but never their decision. */
  decisionsKept: number;
}

const sameFigures = (a: LedgerEntry, b: LedgerEntry) => a.amount === b.amount && a.currency === b.currency && a.fxRate === b.fxRate && a.line === b.line && a.vatIncluded === b.vatIncluded && a.vatRate === b.vatRate && a.dealId === b.dealId;

/**
 * Re-importing the same file changes nothing. An entry is identified by its source key: a new key is added, an unchanged
 * one is left alone, a changed one takes the new figures while keeping a person's earlier review decision and deal.
 */
export function mergeImport(existing: readonly LedgerEntry[], incoming: readonly LedgerEntry[]): MergeResult {
  const byKey = new Map(existing.filter((e) => e.sourceKey).map((e) => [e.sourceKey as string, e]));
  const result = new Map(existing.map((e) => [e.id, e]));
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let decisionsKept = 0;
  const seen = new Set<string>();
  for (const inc of incoming) {
    if (inc.sourceKey && seen.has(inc.sourceKey)) continue; // the same file listing a transaction twice counts once
    if (inc.sourceKey) seen.add(inc.sourceKey);
    const old = inc.sourceKey ? byKey.get(inc.sourceKey) : undefined;
    if (!old) {
      result.set(inc.id, inc);
      inserted++;
    } else if (sameFigures(old, { ...inc, dealId: old.dealId })) {
      unchanged++;
    } else {
      const decided = old.review !== "pending";
      if (decided) decisionsKept++;
      result.set(old.id, { ...inc, id: old.id, dealId: old.dealId, review: old.review, confidence: old.confidence, coveredBy: old.coveredBy, provision: old.provision });
      updated++;
    }
  }
  return { entries: [...result.values()], inserted, updated, unchanged, decisionsKept };
}
