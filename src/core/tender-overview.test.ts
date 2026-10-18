import { describe, expect, it } from "vitest";
import { buildTenderOverview, tenderValue, type OverviewTender } from "./tender-overview";

const T = (over: Partial<OverviewTender> & { id: string }): OverviewTender => ({
  title: `Tender ${over.id}`,
  authority: "MOH",
  status: "pipeline",
  statusChangedAt: "2026-10-10T00:00:00Z",
  estimatedValue: null,
  bidValue: null,
  awardAmount: null,
  contractValue: null,
  deadline: null,
  closeReason: null,
  ...over,
});

const TODAY = "2026-10-18";
const build = (tenders: OverviewTender[], guarantees = [] as Parameters<typeof buildTenderOverview>[0]["guarantees"], invoices = [] as Parameters<typeof buildTenderOverview>[0]["invoices"]) => buildTenderOverview({ today: TODAY, tenders, guarantees, invoices });

describe("tenderValue", () => {
  it("prefers contract, then award, then bid, then estimate", () => {
    expect(tenderValue({ contractValue: 4, awardAmount: 3, bidValue: 2, estimatedValue: 1 })).toBe(4);
    expect(tenderValue({ contractValue: null, awardAmount: 3, bidValue: 2, estimatedValue: 1 })).toBe(3);
    expect(tenderValue({ contractValue: null, awardAmount: null, bidValue: 2, estimatedValue: 1 })).toBe(2);
    expect(tenderValue({ contractValue: null, awardAmount: null, bidValue: null, estimatedValue: 1 })).toBe(1);
    expect(tenderValue({ contractValue: null, awardAmount: null, bidValue: null, estimatedValue: null })).toBeNull();
    expect(tenderValue({ contractValue: 0, awardAmount: 3, bidValue: 2, estimatedValue: 1 })).toBe(0);
  });
});

describe("buildTenderOverview", () => {
  it("is empty and well-formed with no tenders", () => {
    const o = build([]);
    expect(o.total).toBe(0);
    expect(o.phases.map((p) => [p.key, p.count])).toEqual([["before_bidding", 0], ["in_evaluation", 0], ["award_contract", 0], ["delivery_payment", 0], ["closed", 0]]);
    expect(o.results.winRate).toBeNull();
    expect(o.guarantees).toMatchObject({ active: 0, expiredNotReturned: 0, count: 0, soonest: [] });
    expect(o.payments).toEqual({ invoiced: 0, collected: 0, unpaid: 0 });
  });

  it("counts tenders and their best value per phase, flagging those with no value", () => {
    const o = build([
      T({ id: "1", status: "pipeline" }),
      T({ id: "2", status: "preparing", estimatedValue: 1000 }),
      T({ id: "3", status: "submitted", estimatedValue: 5000, bidValue: 4500 }),
      T({ id: "4", status: "contracted", estimatedValue: 5000, bidValue: 4500, awardAmount: 4400, contractValue: 4300 }),
      T({ id: "5", status: "collected", contractValue: 700 }),
      T({ id: "6", status: "lost", bidValue: 900, closeReason: "Price" }),
    ]);
    const p = (k: string) => o.phases.find((x) => x.key === k)!;
    expect(p("before_bidding")).toMatchObject({ count: 2, value: 1000, withoutValue: 1 });
    expect(p("in_evaluation")).toMatchObject({ count: 1, value: 4500 });
    expect(p("award_contract")).toMatchObject({ count: 1, value: 4300 });
    expect(p("delivery_payment")).toMatchObject({ count: 1, value: 700 });
    expect(p("closed")).toMatchObject({ count: 1, value: 900 });
  });

  it("works out the win rate from decided tenders only", () => {
    const o = build([
      T({ id: "1", status: "won", awardAmount: 100 }),
      T({ id: "2", status: "delivered", contractValue: 300 }),
      T({ id: "3", status: "lost", closeReason: "Price" }),
      T({ id: "4", status: "cancelled" }),
      T({ id: "5", status: "technical_review" }),
    ]);
    expect(o.results).toMatchObject({ won: 2, lost: 1, wonValue: 400 });
    expect(o.results.winRate).toBeCloseTo(2 / 3);
    expect(o.results.recentLost).toEqual([{ id: "3", title: "Tender 3", authority: "MOH", reason: "Price" }]);
  });

  it("lists upcoming deadlines soonest first, only before submission, and shows passed ones apart", () => {
    const o = build([
      T({ id: "a", status: "preparing", deadline: "2026-10-25" }),
      T({ id: "b", status: "open", deadline: "2026-10-18" }),
      T({ id: "c", status: "submitted", deadline: "2026-10-20" }),
      T({ id: "d", status: "open", deadline: "2026-10-10" }),
      T({ id: "e", status: "pipeline", deadline: null }),
    ]);
    expect(o.deadlines.upcoming.map((d) => [d.id, d.daysLeft])).toEqual([["b", 0], ["a", 7]]);
    expect(o.deadlines.passed.map((d) => [d.id, d.daysAgo])).toEqual([["d", 8]]);
  });

  it("adds up cash tied in guarantees and lists the soonest expiries", () => {
    const tenders = [T({ id: "1", title: "Analyzer" }), T({ id: "2", title: "Reagents", authority: "KHCC" })];
    const o = build(tenders, [
      { tenderId: "1", amount: 5000, expiresOn: "2026-12-01", returnedOn: null },
      { tenderId: "2", amount: 2000, expiresOn: "2026-11-01", returnedOn: null },
      { tenderId: "2", amount: 750, expiresOn: "2026-09-01", returnedOn: null },
      { tenderId: "1", amount: 9000, expiresOn: "2026-10-30", returnedOn: "2026-10-15" },
    ]);
    expect(o.guarantees).toMatchObject({ active: 7000, expiredNotReturned: 750, count: 4 });
    expect(o.guarantees.soonest.map((g) => [g.title, g.amount, g.daysLeft])).toEqual([["Reagents", 2000, 14], ["Analyzer", 5000, 44]]);
  });

  it("reports unpaid money by authority and in total", () => {
    const tenders = [T({ id: "1", authority: "MOH", status: "delivered" }), T({ id: "2", authority: "JUH", status: "delivered" })];
    const o = build(tenders, [], [
      { tenderId: "1", amount: 1000, collected: 400 },
      { tenderId: "1", amount: 500, collected: 500 },
      { tenderId: "2", amount: 200, collected: 0 },
    ]);
    expect(o.authorities.find((a) => a.code === "MOH")!.unpaid).toBe(600);
    expect(o.authorities.find((a) => a.code === "JUH")!.unpaid).toBe(200);
    expect(o.authorities.find((a) => a.code === "KAUH")!.unpaid).toBe(0);
    expect(o.payments).toEqual({ invoiced: 1700, collected: 900, unpaid: 800 });
  });

  it("counts active, won and lost tenders per authority", () => {
    const o = build([
      T({ id: "1", authority: "KHCC", status: "preparing", estimatedValue: 300 }),
      T({ id: "2", authority: "KHCC", status: "won", awardAmount: 50 }),
      T({ id: "3", authority: "KHCC", status: "lost" }),
      T({ id: "4", authority: "KHCC", status: "collected", contractValue: 10 }),
    ]);
    expect(o.authorities.find((a) => a.code === "KHCC")).toMatchObject({ active: 2, activeValue: 350, won: 2, lost: 1 });
  });

  it("lists the longest time in the current stage as a plain count, active tenders only", () => {
    const o = build([
      T({ id: "old", status: "preparing", statusChangedAt: "2026-08-01T08:00:00Z" }),
      T({ id: "new", status: "open", statusChangedAt: "2026-10-17T08:00:00Z" }),
      T({ id: "done", status: "collected", statusChangedAt: "2026-01-01T08:00:00Z" }),
      T({ id: "lost", status: "lost", statusChangedAt: "2026-01-01T08:00:00Z" }),
    ]);
    expect(o.longestInStage.map((x) => [x.id, x.days])).toEqual([["old", 78], ["new", 1]]);
  });
});
