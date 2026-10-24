/**
 * Price history from the authorities' award results. Pure rules shared by the page, the sample page and the tests.
 *
 * What it will and will not say:
 *  - Only JOD prices are compared. A price in another currency is counted but never converted, because no exchange
 *    rate is recorded and a guessed one would be worse than a gap.
 *  - An unknown price stays unknown. An authority that publishes only the winner gives one price for that item, and the
 *    other bidders do not count as "no bid" or as zero.
 *  - Every figure carries the number of awards it rests on, and a thin basis is called thin.
 */

export const BID_OUTCOMES = ["won", "lost", "disqualified", "withdrawn", "unknown"] as const;
export type BidOutcome = (typeof BID_OUTCOMES)[number];

export const OUTCOME_LABEL: Record<BidOutcome, string> = {
  won: "Won",
  lost: "Lost",
  disqualified: "Disqualified",
  withdrawn: "Withdrawn",
  unknown: "Not stated",
};

export const CURRENCIES = ["JOD", "USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** One bid on one item in one tender, with the item and tender it belongs to. The service builds these from the tables. */
export interface BidRow {
  archiveId: string;
  authority: string;
  tenderNo: string;
  awardDate: string;
  lineId: string;
  /** Groups the same item across tenders: the product when the code is known, else the cleaned item name. */
  itemKey: string;
  itemName: string;
  therapeuticArea: string | null;
  quantity: number | null;
  bidder: string;
  isOwn: boolean;
  unitPrice: number | null;
  currency: string;
  outcome: BidOutcome;
  awardedQuantity: number | null;
}

/** Same item, different spelling: case, spacing and punctuation do not make a new item. */
export function itemKeyOf(productId: string | null, itemName: string): string {
  if (productId) return `p:${productId}`;
  const cleaned = itemName
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, " ")
    .trim();
  return `n:${cleaned}`;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Linear-interpolated quantile, q between 0 and 1. */
export function quantile(values: number[], q: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}

export type Basis = "none" | "thin" | "fair" | "good";

/** How much to lean on a figure that rests on `n` awards. */
export function basisOf(n: number): Basis {
  return n === 0 ? "none" : n < 3 ? "thin" : n < 10 ? "fair" : "good";
}

export const BASIS_LABEL: Record<Basis, string> = {
  none: "No awards",
  thin: "Thin: indicative only",
  fair: "Fair",
  good: "Good basis",
};

const isJod = (r: BidRow) => r.currency === "JOD";
const priced = (r: BidRow): r is BidRow & { unitPrice: number } => r.unitPrice !== null && isJod(r);

export interface ItemSummary {
  itemKey: string;
  itemName: string;
  therapeuticArea: string | null;
  /** Tenders in which this item was asked for. */
  tenders: number;
  /** Winning prices known (JOD). */
  awards: number;
  awardMedian: number | null;
  awardLow: number | null;
  awardHigh: number | null;
  /** p25 to median: the lower half of what was paid, a sensible place to aim a bid. */
  bandLow: number | null;
  bandHigh: number | null;
  lastAwardDate: string | null;
  lastAwardPrice: number | null;
  lastAwardAuthority: string | null;
  basis: Basis;
  /** Our bids with an outcome stated, and how many of them won. */
  ourDecided: number;
  ourWins: number;
  ourBids: number;
  ourMedianBid: number | null;
  /** Our median bid against the median award: +0.08 means we bid 8% above what was paid. */
  ourGap: number | null;
  competitorPrices: number;
  otherCurrency: number;
}

export function summarizeItems(rows: BidRow[]): ItemSummary[] {
  const byItem = new Map<string, BidRow[]>();
  for (const r of rows) byItem.set(r.itemKey, [...(byItem.get(r.itemKey) ?? []), r]);
  const out: ItemSummary[] = [];
  for (const [itemKey, list] of byItem) {
    const wins = list.filter((r) => r.outcome === "won" && priced(r)) as (BidRow & { unitPrice: number })[];
    const winPrices = wins.map((r) => r.unitPrice);
    const last = [...wins].sort((a, b) => b.awardDate.localeCompare(a.awardDate))[0];
    const own = list.filter((r) => r.isOwn);
    const ownPrices = own.filter(priced).map((r) => r.unitPrice);
    const decided = own.filter((r) => r.outcome !== "unknown");
    const awardMedian = median(winPrices);
    const ourMedianBid = median(ownPrices);
    // The newest spelling of the name is the one shown.
    const newest = [...list].sort((a, b) => b.awardDate.localeCompare(a.awardDate))[0]!;
    out.push({
      itemKey,
      itemName: newest.itemName,
      therapeuticArea: list.map((r) => r.therapeuticArea).find((a) => a !== null) ?? null,
      tenders: new Set(list.map((r) => r.archiveId)).size,
      awards: winPrices.length,
      awardMedian,
      awardLow: winPrices.length ? Math.min(...winPrices) : null,
      awardHigh: winPrices.length ? Math.max(...winPrices) : null,
      bandLow: quantile(winPrices, 0.25),
      bandHigh: awardMedian,
      lastAwardDate: last?.awardDate ?? null,
      lastAwardPrice: last?.unitPrice ?? null,
      lastAwardAuthority: last?.authority ?? null,
      basis: basisOf(winPrices.length),
      ourDecided: decided.length,
      ourWins: decided.filter((r) => r.outcome === "won").length,
      ourBids: new Set(own.map((r) => r.lineId)).size,
      ourMedianBid,
      ourGap: awardMedian !== null && ourMedianBid !== null && awardMedian > 0 ? ourMedianBid / awardMedian - 1 : null,
      competitorPrices: list.filter((r) => !r.isOwn && priced(r)).length,
      otherCurrency: list.filter((r) => r.unitPrice !== null && !isJod(r)).length,
    });
  }
  return out.sort((a, b) => b.tenders - a.tenders || a.itemName.localeCompare(b.itemName));
}

export interface AuthorityCoverage {
  authority: string;
  tenders: number;
  items: number;
  /** Items where at least one winning price is known. */
  itemsWithWinnerPrice: number;
  /** Items where two or more bidders' prices are known: the competitors can be compared. */
  itemsWithBidderPrices: number;
}

export interface Coverage {
  tenders: number;
  items: number;
  bids: number;
  firstDate: string | null;
  lastDate: string | null;
  itemsWithWinnerPrice: number;
  itemsWithBidderPrices: number;
  bidsInOtherCurrency: number;
  byAuthority: AuthorityCoverage[];
}

/** What the data can support, so the person sees the gaps before trusting a price. */
export function coverageOf(rows: BidRow[]): Coverage {
  const lines = new Map<string, BidRow[]>();
  for (const r of rows) lines.set(r.lineId, [...(lines.get(r.lineId) ?? []), r]);
  const lineInfo = [...lines.values()].map((l) => ({
    authority: l[0]!.authority,
    archiveId: l[0]!.archiveId,
    winner: l.some((r) => r.outcome === "won" && priced(r)),
    compared: l.filter(priced).length >= 2,
  }));
  const dates = rows.map((r) => r.awardDate).sort();
  const authorities = [...new Set(lineInfo.map((l) => l.authority))].sort();
  return {
    tenders: new Set(rows.map((r) => r.archiveId)).size,
    items: lines.size,
    bids: rows.length,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
    itemsWithWinnerPrice: lineInfo.filter((l) => l.winner).length,
    itemsWithBidderPrices: lineInfo.filter((l) => l.compared).length,
    bidsInOtherCurrency: rows.filter((r) => r.unitPrice !== null && !isJod(r)).length,
    byAuthority: authorities.map((authority) => {
      const mine = lineInfo.filter((l) => l.authority === authority);
      return {
        authority,
        tenders: new Set(mine.map((l) => l.archiveId)).size,
        items: mine.length,
        itemsWithWinnerPrice: mine.filter((l) => l.winner).length,
        itemsWithBidderPrices: mine.filter((l) => l.compared).length,
      };
    }),
  };
}

export const GAP_BUCKETS = [
  { key: "won", label: "We won" },
  { key: "within5", label: "Lost, within 5% of the winner" },
  { key: "within10", label: "Lost, 5% to 10% above the winner" },
  { key: "within20", label: "Lost, 10% to 20% above the winner" },
  { key: "over20", label: "Lost, more than 20% above the winner" },
] as const;
export type GapKey = (typeof GAP_BUCKETS)[number]["key"];

/**
 * How close we lose. Only our bids whose price and the winner's price are both known are placed; the rest are counted
 * as "not placed" so the table never claims more than it knows.
 */
export function gapDistribution(rows: BidRow[]): { buckets: { key: GapKey; label: string; count: number }[]; placed: number; notPlaced: number } {
  const lines = new Map<string, BidRow[]>();
  for (const r of rows) lines.set(r.lineId, [...(lines.get(r.lineId) ?? []), r]);
  const counts = new Map<GapKey, number>(GAP_BUCKETS.map((b) => [b.key, 0]));
  let placed = 0;
  let notPlaced = 0;
  for (const list of lines.values()) {
    const winnerPrices = list.filter((r) => !r.isOwn && r.outcome === "won" && priced(r)).map((r) => r.unitPrice as number);
    for (const own of list.filter((r) => r.isOwn && r.outcome !== "unknown")) {
      if (own.outcome === "won") {
        counts.set("won", counts.get("won")! + 1);
        placed++;
        continue;
      }
      if (!priced(own) || winnerPrices.length === 0 || Math.min(...winnerPrices) <= 0) {
        notPlaced++;
        continue;
      }
      const gap = own.unitPrice / Math.min(...winnerPrices) - 1;
      const key: GapKey = gap <= 0.05 ? "within5" : gap <= 0.1 ? "within10" : gap <= 0.2 ? "within20" : "over20";
      counts.set(key, counts.get(key)! + 1);
      placed++;
    }
  }
  return { buckets: GAP_BUCKETS.map((b) => ({ key: b.key, label: b.label, count: counts.get(b.key)! })), placed, notPlaced };
}

export interface AreaSummary {
  area: string;
  items: number;
  /** Awarded value of the winning bids whose price and quantity are both known, JOD. */
  awardedValue: number;
  /** The part of that value that went to us. */
  ourValue: number;
  /** Winning bids with a price but no quantity: they are in the item counts but not in the value. */
  valueUnknown: number;
}

/** Where the money went, by therapeutic area, for the tenders awarded on or after `since` (YYYY-MM-DD). */
export function areaSummary(rows: BidRow[], since: string | null = null): AreaSummary[] {
  const byArea = new Map<string, { lines: Set<string>; value: number; own: number; unknown: number }>();
  for (const r of rows) {
    if (since !== null && r.awardDate < since) continue;
    const area = r.therapeuticArea ?? "Not classified";
    const a = byArea.get(area) ?? { lines: new Set<string>(), value: 0, own: 0, unknown: 0 };
    a.lines.add(r.lineId);
    if (r.outcome === "won" && priced(r)) {
      const qty = r.awardedQuantity ?? r.quantity;
      if (qty === null) a.unknown++;
      else {
        a.value += qty * r.unitPrice;
        if (r.isOwn) a.own += qty * r.unitPrice;
      }
    }
    byArea.set(area, a);
  }
  return [...byArea]
    .map(([area, a]) => ({ area, items: a.lines.size, awardedValue: a.value, ourValue: a.own, valueUnknown: a.unknown }))
    .sort((x, y) => y.awardedValue - x.awardedValue || x.area.localeCompare(y.area));
}

export interface TenderLineView {
  archiveId: string;
  awardDate: string;
  authority: string;
  tenderNo: string;
  quantity: number | null;
  bidders: number;
  winner: string | null;
  winnerPrice: number | null;
  ourPrice: number | null;
  ourOutcome: BidOutcome | null;
}

/** Every tender that asked for one item, newest first, as the detail view lists them. */
export function itemHistory(rows: BidRow[], itemKey: string): TenderLineView[] {
  const lines = new Map<string, BidRow[]>();
  for (const r of rows) if (r.itemKey === itemKey) lines.set(r.lineId, [...(lines.get(r.lineId) ?? []), r]);
  return [...lines.values()]
    .map((l): TenderLineView => {
      const first = l[0]!;
      const win = l.find((r) => r.outcome === "won");
      const own = l.find((r) => r.isOwn);
      return {
        archiveId: first.archiveId,
        awardDate: first.awardDate,
        authority: first.authority,
        tenderNo: first.tenderNo,
        quantity: first.quantity,
        bidders: l.length,
        winner: win?.bidder ?? null,
        winnerPrice: win && priced(win) ? win.unitPrice : null,
        ourPrice: own && priced(own) ? own.unitPrice : null,
        ourOutcome: own?.outcome ?? null,
      };
    })
    .sort((a, b) => b.awardDate.localeCompare(a.awardDate));
}
