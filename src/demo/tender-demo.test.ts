import { itemTotals } from "@/core/tender-items";
import { describe, expect, it } from "vitest";
import { AUTHORITIES, isLegalMove, missingFor, type TenderFields } from "@/core/tender-flow";
import { DEMO_GUARANTEES, DEMO_INVOICES, DEMO_TENDERS, demoTenderDetail, demoTenderOverview } from "./tender-demo";

describe("demo item lines", () => {
  it("add up to the tender's estimated and bid values wherever the lines carry those prices", () => {
    const withItems = DEMO_TENDERS.filter((t) => t.items.length > 0);
    expect(withItems.length).toBeGreaterThan(2);
    for (const t of withItems) {
      const totals = itemTotals(t.items);
      if (totals.estimated !== null && t.estimatedValue !== null) expect(totals.estimated, `${t.id} estimate`).toBe(t.estimatedValue);
      if (totals.bid !== null) expect(totals.bid, `${t.id} bid`).toBe(t.bidValue);
      // a tender whose bid is already in must have every line priced
      if (t.bidValue !== null) expect(totals.unpriced, `${t.id} unpriced lines`).toBe(0);
    }
  });
});

describe("demo tenders", () => {
  it("covers every authority and every status the live screens know", () => {
    expect(new Set(DEMO_TENDERS.map((t) => t.authority))).toEqual(new Set(AUTHORITIES.map((a) => a.code)));
    expect(new Set(DEMO_TENDERS.map((t) => t.status)).size).toBe(12);
  });

  it("has a history that only makes legal moves and ends at the tender's status", () => {
    for (const t of DEMO_TENDERS) {
      expect(t.history.at(-1)!.to).toBe(t.status);
      for (let i = 1; i < t.history.length; i++) expect(isLegalMove(t.history[i - 1]!.to, t.history[i]!.to), `${t.id}: ${t.history[i - 1]!.to} → ${t.history[i]!.to}`).toBe(true);
    }
  });

  it("holds the details its status requires", () => {
    for (const t of DEMO_TENDERS) {
      const fields: TenderFields = { tenderNo: t.tenderNo, estimatedValue: t.estimatedValue, deadline: t.deadline, bidValue: t.bidValue, awardAmount: t.awardAmount, closeReason: t.closeReason, closeReasonCode: t.closeReasonCode, winnerName: t.winnerName, winningPrice: t.winningPrice, expectedAwardDate: t.expectedAwardDate, contractNo: t.contractNo, contractValue: t.contractValue, deliveredOn: t.deliveredOn };
      const need = t.status === "pipeline" ? [] : missingFor(t.status, fields);
      expect(need, `${t.id} (${t.status}) is missing ${need.join(", ")}`).toEqual([]);
    }
  });

  it("points every guarantee and invoice at a demo tender", () => {
    const ids = new Set(DEMO_TENDERS.map((t) => t.id));
    for (const g of DEMO_GUARANTEES) expect(ids.has(g.tenderId)).toBe(true);
    for (const i of DEMO_INVOICES) expect(ids.has(i.tenderId)).toBe(true);
  });

  it("keeps the collected tender fully paid, as the live rule requires", () => {
    const paid = demoTenderDetail("d9")!;
    expect(paid.payments.fullyCollected).toBe(true);
  });

  it("produces an overview that shows every part of the live one", () => {
    const o = demoTenderOverview();
    expect(o.total).toBe(13);
    expect(o.results).toMatchObject({ won: 4, lost: 1 });
    expect(o.deadlines.upcoming.length).toBeGreaterThan(0);
    expect(o.deadlines.passed.map((d) => d.title)).toContain("Pulse oximeters");
    expect(o.guarantees.active).toBeGreaterThan(0);
    expect(o.guarantees.expiredNotReturned).toBe(22438);
    expect(o.payments).toEqual({ invoiced: 695950, collected: 340290, unpaid: 355660 });
    expect(o.authorities.find((a) => a.code === "JUH")!.unpaid).toBe(355660);
  });
});
