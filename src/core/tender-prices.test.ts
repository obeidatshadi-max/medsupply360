import { describe, expect, it } from "vitest";
import { areaSummary, basisOf, coverageOf, gapDistribution, itemHistory, itemKeyOf, median, quantile, summarizeItems, type BidRow } from "./tender-prices";

let n = 0;
const bid = (over: Partial<BidRow>): BidRow => ({
  archiveId: "T1",
  authority: "MOH",
  tenderNo: "1",
  awardDate: "2025-01-01",
  lineId: "L1",
  itemKey: "n:glucose strips",
  itemName: "Glucose strips",
  therapeuticArea: "Diabetes",
  quantity: 100,
  bidder: `B${n++}`,
  isOwn: false,
  unitPrice: 10,
  currency: "JOD",
  outcome: "lost",
  awardedQuantity: null,
  ...over,
});

describe("small statistics", () => {
  it("median and quantile", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(quantile([1, 2, 3, 4, 5], 0.25)).toBe(2);
  });
  it("calls a figure thin until there are three awards", () => {
    expect([0, 1, 2, 3, 9, 10].map(basisOf)).toEqual(["none", "thin", "thin", "fair", "fair", "good"]);
  });
  it("treats spelling variants of an item name as one item, but a product as its own", () => {
    expect(itemKeyOf(null, "Glucose  Strips (50)")).toBe(itemKeyOf(null, "glucose strips 50"));
    expect(itemKeyOf("abc", "anything")).toBe("p:abc");
  });
});

describe("item summary", () => {
  const rows = [
    bid({ lineId: "L1", archiveId: "T1", awardDate: "2024-01-01", outcome: "won", unitPrice: 10 }),
    bid({ lineId: "L2", archiveId: "T2", awardDate: "2025-01-01", authority: "KHCC", outcome: "won", unitPrice: 12 }),
    bid({ lineId: "L3", archiveId: "T3", awardDate: "2025-06-01", outcome: "won", unitPrice: 14 }),
    bid({ lineId: "L3", archiveId: "T3", awardDate: "2025-06-01", isOwn: true, bidder: "Sadaf", outcome: "lost", unitPrice: 15 }),
    bid({ lineId: "L2", archiveId: "T2", awardDate: "2025-01-01", authority: "KHCC", isOwn: true, bidder: "Sadaf", outcome: "unknown", unitPrice: 12 }),
    bid({ lineId: "L1", archiveId: "T1", awardDate: "2024-01-01", currency: "USD", unitPrice: 99 }),
  ];
  const [item] = summarizeItems(rows);

  it("prices what was paid from winning JOD prices only", () => {
    expect(item).toMatchObject({ tenders: 3, awards: 3, awardMedian: 12, awardLow: 10, awardHigh: 14, basis: "fair", otherCurrency: 1 });
    expect(item!.bandLow).toBe(11);
    expect(item!.lastAwardDate).toBe("2025-06-01");
    expect(item!.lastAwardPrice).toBe(14);
  });
  it("counts our win rate only over bids whose result is known", () => {
    expect(item).toMatchObject({ ourBids: 2, ourDecided: 1, ourWins: 0, ourMedianBid: 13.5 });
    expect(item!.ourGap).toBeCloseTo(0.125);
  });
  it("leaves the gap unknown when there is no award price", () => {
    const [only] = summarizeItems([bid({ isOwn: true, unitPrice: 8, outcome: "lost" })]);
    expect(only).toMatchObject({ awards: 0, awardMedian: null, ourGap: null, basis: "none" });
  });
});

describe("coverage", () => {
  it("separates items with a winner price from items where bidders can be compared", () => {
    const rows = [
      bid({ lineId: "L1", outcome: "won", unitPrice: 10 }),
      bid({ lineId: "L1", unitPrice: 11 }),
      bid({ lineId: "L2", archiveId: "T2", authority: "KHCC", outcome: "won", unitPrice: 5 }),
      bid({ lineId: "L3", archiveId: "T2", authority: "KHCC", outcome: "won", unitPrice: null }),
    ];
    const c = coverageOf(rows);
    expect(c).toMatchObject({ tenders: 2, items: 3, bids: 4, itemsWithWinnerPrice: 2, itemsWithBidderPrices: 1 });
    expect(c.byAuthority.map((a) => [a.authority, a.items, a.itemsWithWinnerPrice])).toEqual([
      ["KHCC", 2, 1],
      ["MOH", 1, 1],
    ]);
  });
});

describe("how close we lose", () => {
  it("places our lost bids by how far above the winner they were, and says how many it could not place", () => {
    const rows = [
      bid({ lineId: "A", outcome: "won", unitPrice: 100 }),
      bid({ lineId: "A", isOwn: true, bidder: "Sadaf", outcome: "lost", unitPrice: 104 }),
      bid({ lineId: "B", outcome: "won", unitPrice: 100 }),
      bid({ lineId: "B", isOwn: true, bidder: "Sadaf", outcome: "lost", unitPrice: 130 }),
      bid({ lineId: "C", isOwn: true, bidder: "Sadaf", outcome: "won", unitPrice: 50 }),
      bid({ lineId: "D", isOwn: true, bidder: "Sadaf", outcome: "lost", unitPrice: 50 }), // no winner price known
    ];
    const g = gapDistribution(rows);
    expect(Object.fromEntries(g.buckets.map((b) => [b.key, b.count]))).toEqual({ won: 1, within5: 1, within10: 0, within20: 0, over20: 1 });
    expect(g).toMatchObject({ placed: 3, notPlaced: 1 });
  });
});

describe("value by therapeutic area", () => {
  it("adds quantity times winning price, and counts winners whose quantity is unknown instead of guessing", () => {
    const rows = [
      bid({ lineId: "A", outcome: "won", unitPrice: 10, quantity: 100 }),
      bid({ lineId: "B", outcome: "won", unitPrice: 20, quantity: 10, isOwn: true, bidder: "Sadaf", awardedQuantity: 5 }),
      bid({ lineId: "C", outcome: "won", unitPrice: 20, quantity: null }),
      bid({ lineId: "D", therapeuticArea: null, outcome: "won", unitPrice: 1, quantity: 1 }),
      bid({ lineId: "E", awardDate: "2020-01-01", outcome: "won", unitPrice: 1000, quantity: 1000 }),
    ];
    const all = areaSummary(rows, "2024-01-01");
    expect(all.find((a) => a.area === "Diabetes")).toMatchObject({ awardedValue: 1100, ourValue: 100, valueUnknown: 1, items: 3 });
    expect(all.find((a) => a.area === "Not classified")).toMatchObject({ awardedValue: 1 });
  });
});

describe("item history", () => {
  it("lists each tender that asked for the item, newest first, with the winner and our result", () => {
    const rows = [
      bid({ lineId: "A", awardDate: "2024-01-01", outcome: "won", bidder: "Rival", unitPrice: 9 }),
      bid({ lineId: "B", archiveId: "T2", awardDate: "2025-01-01", outcome: "won", bidder: "Sadaf", isOwn: true, unitPrice: 8 }),
      bid({ lineId: "B", archiveId: "T2", awardDate: "2025-01-01", bidder: "Other", unitPrice: 9 }),
    ];
    const h = itemHistory(rows, "n:glucose strips");
    expect(h.map((x) => [x.awardDate, x.winner, x.winnerPrice, x.ourPrice, x.ourOutcome, x.bidders])).toEqual([
      ["2025-01-01", "Sadaf", 8, 8, "won", 2],
      ["2024-01-01", "Rival", 9, null, null, 1],
    ]);
  });
});
