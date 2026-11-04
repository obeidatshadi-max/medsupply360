/**
 * The cost ledger of one deal: turns raw entries into VAT-exclusive JOD fils and decides, entry by entry, whether each one
 * is COUNTED in profit or HELD OUT (and why). Holding out is explicit and listed, so nothing disappears silently and the
 * same transaction can never be counted twice.
 */
import type { Deal, LedgerEntry, LedgerLine, RebateEntry } from "./types";

/** JOD to whole fils and back. */
export const toFils = (jod: number): number => Math.sign(jod) * Math.round(Number((Math.abs(jod) * 1000).toPrecision(12)));
export const fromFils = (fils: number): number => fils / 1000;

/** A percentage of `part` in `whole`, one decimal, or null when there is no sensible denominator. */
export function pct(partFils: number, wholeFils: number): number | null {
  if (wholeFils <= 0) return null;
  return Math.round((partFils / wholeFils) * 1000) / 10;
}

export type HoldReason = "duplicate" | "covered_by_other_line" | "wrong_deal" | "pending_review" | "rejected" | "no_fx_rate";

export interface NormalisedEntry {
  entry: LedgerEntry;
  /** VAT-exclusive JOD fils; null when the entry cannot be converted. */
  fils: number | null;
}

export interface HeldOut {
  entry: LedgerEntry;
  fils: number | null;
  reason: HoldReason;
  /** For a duplicate: the id of the entry that was kept. */
  keptId?: string;
}

export interface Classified {
  counted: NormalisedEntry[];
  heldOut: HeldOut[];
}

/** VAT-exclusive JOD fils for one entry, or null when a foreign currency has no recorded rate. */
export function entryFils(e: Pick<LedgerEntry, "amount" | "currency" | "fxRate" | "vatIncluded" | "vatRate">): number | null {
  const rate = e.currency === "JOD" ? 1 : e.fxRate;
  if (rate === null || !(rate > 0)) return null;
  const net = e.vatIncluded ? e.amount / (1 + e.vatRate) : e.amount;
  return toFils(net * rate);
}

/** Same rule for a rebate, which carries no VAT field (supplier rebates are credits on the supplier invoice, outside VAT). */
export function rebateFils(r: Pick<RebateEntry, "amount" | "currency" | "fxRate">): number | null {
  const rate = r.currency === "JOD" ? 1 : r.fxRate;
  if (rate === null || !(rate > 0)) return null;
  return toFils(r.amount * rate);
}

const byDateThenId = (a: LedgerEntry, b: LedgerEntry) => (a.incurredOn ?? "").localeCompare(b.incurredOn ?? "") || a.id.localeCompare(b.id);

/**
 * Splits the entries of a deal into counted and held out, in a fixed order so the result is reproducible:
 *  1. entries that belong to another deal (a different deal id, or a customer/contract reference that disagrees),
 *  2. rejected and still-pending matches (a person has not confirmed a medium/low match),
 *  3. no exchange rate,
 *  4. costs already inside another line,
 *  5. duplicates of an ERP transaction already counted (same source key, or same document number and line on the same
 *     ledger line).
 * `external` lists source keys already counted by OTHER deals: the same transaction cannot sit in two deals.
 */
export function classify(deal: Deal, entries: readonly LedgerEntry[], external: ReadonlySet<string> = new Set()): Classified {
  const counted: NormalisedEntry[] = [];
  const heldOut: HeldOut[] = [];
  const seenKey = new Map<string, string>();
  const seenDoc = new Map<string, string>();

  for (const entry of [...entries].sort(byDateThenId)) {
    const fils = entryFils(entry);
    const hold = (reason: HoldReason, keptId?: string) => heldOut.push({ entry, fils, reason, keptId });

    const otherDeal = entry.dealId !== deal.id || (deal.customerRef !== null && entry.customerRef !== null && entry.customerRef !== deal.customerRef);
    if (otherDeal) hold("wrong_deal");
    else if (entry.review === "rejected") hold("rejected");
    // An exact match on a stable identifier counts without a person's click; every weaker match waits for a decision.
    else if (entry.review === "pending" && entry.confidence !== "exact") hold("pending_review");
    else if (fils === null) hold("no_fx_rate");
    else if (entry.coveredBy !== null) hold("covered_by_other_line");
    else {
      const docKey = entry.source ? `${entry.line}|${entry.source.system}|${entry.source.docType}|${entry.source.docNo}|${entry.source.lineNo ?? ""}` : null;
      const keptByKey = entry.sourceKey ? seenKey.get(entry.sourceKey) : undefined;
      const keptByDoc = docKey ? seenDoc.get(docKey) : undefined;
      if (keptByKey !== undefined || keptByDoc !== undefined) hold("duplicate", keptByKey ?? keptByDoc);
      else if (entry.sourceKey && external.has(entry.sourceKey)) hold("duplicate");
      else {
        if (entry.sourceKey) seenKey.set(entry.sourceKey, entry.id);
        if (docKey) seenDoc.set(docKey, entry.id);
        counted.push({ entry, fils });
      }
    }
  }
  return { counted, heldOut };
}

export interface LineSums {
  actual: number;
  estimated: number;
  /** Provisions (warranty) are summed apart so the realized view can include them as estimates. */
  provision: number;
  disputed: number;
  ids: string[];
}

export const emptySums = (): LineSums => ({ actual: 0, estimated: 0, provision: 0, disputed: 0, ids: [] });

/** Fils per ledger line, split by status. Credits (negative amounts) reduce the line. */
export function sumByLine(counted: readonly NormalisedEntry[]): Record<LedgerLine, LineSums> {
  const out = {
    discount: emptySums(),
    acquisition: emptySums(),
    freight_customs: emptySums(),
    installation: emptySums(),
    warranty: emptySums(),
    commission: emptySums(),
    financing: emptySums(),
    other: emptySums(),
  } satisfies Record<LedgerLine, LineSums>;
  for (const { entry, fils } of counted) {
    if (fils === null) continue;
    const s = out[entry.line];
    s.ids.push(entry.id);
    if (entry.status === "disputed") s.disputed += fils;
    else if (entry.provision) s.provision += fils;
    else if (entry.status === "estimated") s.estimated += fils;
    else s.actual += fils;
  }
  return out;
}
