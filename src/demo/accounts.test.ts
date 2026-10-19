import { describe, expect, it } from "vitest";
import { invoices, lines, stock, tenders, units } from "./dataset";
import { accounts, tenderProgress } from "./accounts-dataset";
import { PERIOD_DAYS, allAccountRows, privateInsights, segmentComparison, tenderBoard, viewRows, viewSummary } from "./accounts";

const row = (id: string) => allAccountRows().find((r) => r.seed.id === id)!;

describe("accounts reconcile to the company", () => {
  it("sales, gross profit and direct costs by line add up exactly to the business-line totals", () => {
    for (const l of lines) {
      const sum = (k: "sales" | "grossProfit" | "directCosts") => accounts.reduce((a, s) => a + s.byLine[l.name][k], 0);
      expect(sum("sales"), `${l.name} sales`).toBe(l.rev);
      expect(sum("grossProfit"), `${l.name} gross profit`).toBe(l.gp);
      expect(sum("directCosts"), `${l.name} direct costs`).toBe(l.cost);
    }
  });
  it("cash collected adds up to the company total and outstanding = sales - collected", () => {
    expect(accounts.reduce((a, s) => a + s.collected, 0)).toBe(lines.reduce((a, l) => a + l.col, 0));
    for (const r of allAccountRows()) expect(r.outstanding, r.seed.id).toBe(r.sales - r.seed.collected);
  });
  it("listed overdue invoices add up to the account overdue, and every invoice belongs to an account", () => {
    for (const i of invoices) expect(accounts.some((a) => a.name === i.account), i.account).toBe(true);
    expect(allAccountRows().reduce((a, r) => a + r.overdue, 0)).toBe(117_067);
    for (const r of allAccountRows()) expect(r.overdue, r.seed.id).toBeLessThanOrEqual(r.outstanding);
  });
  it("installed units, tenders and invoices refer to existing accounts, and tenders belong to tender accounts", () => {
    const names = new Set(accounts.map((a) => a.name));
    for (const u of units) expect(names.has(u.account), u.id).toBe(true);
    for (const t of tenders) {
      expect(names.has(t.account), t.id).toBe(true);
      expect(accounts.find((a) => a.name === t.account)!.segment, t.id).toBe("Tender");
    }
  });
  it("tender billing never exceeds delivery or value, and sits inside the account balance", () => {
    for (const t of tenders) {
      const p = tenderProgress[t.id]!;
      expect(p.invoiced, t.id).toBeLessThanOrEqual((t.value * p.deliveredPct) / 100);
      expect(p.collected, t.id).toBeLessThanOrEqual(p.invoiced);
      const acct = row(accounts.find((a) => a.name === t.account)!.id);
      expect(p.invoiced - p.collected, t.id).toBeLessThanOrEqual(acct.outstanding);
    }
  });
  it("no account is in both segments and segments add up to the company", () => {
    const c = segmentComparison();
    expect(c.tender.accounts + c.private.accounts).toBe(c.all.accounts);
    expect(c.tender.sales + c.private.sales).toBe(c.all.sales);
    expect(c.tender.grossProfit + c.private.grossProfit).toBe(c.all.grossProfit);
    expect(c.tender.outstanding + c.private.outstanding).toBe(c.all.outstanding);
    expect(c.tender.overdue + c.private.overdue).toBe(c.all.overdue);
    expect(c.all.sales).toBe(4_540_013);
    expect(c.all.grossProfit).toBe(1_510_043);
    expect(c.all.contribution).toBe(1_321_680);
  });
  it("stock is untouched by the account split", () => {
    expect(stock.length).toBeGreaterThan(0);
  });
});

describe("account rows", () => {
  it("gross profit, margin, contribution and share", () => {
    const t1 = row("T-01");
    expect(t1.sales).toBe(770_838);
    expect(t1.grossProfit).toBe(246_804);
    expect(t1.margin).toBeCloseTo(0.3202, 3);
    expect(t1.contribution).toBe(225_085);
    expect(allAccountRows().reduce((a, r) => a + r.gpShare, 0)).toBeCloseTo(1);
    expect(row("P-03").grossProfit).toBe(120_226);
    expect(row("P-03").margin).toBeCloseTo(0.4218, 3);
  });
  it("growth, target attainment, credit use and DSO", () => {
    const p4 = row("P-04");
    expect(p4.salesYoy).toBeCloseTo(p4.sales / p4.seed.priorSales - 1);
    expect(p4.attainment).toBeCloseTo(379.17 / 350);
    expect(p4.creditUse).toBeCloseTo(7.862 / 25);
    expect(row("T-01").dso).toBeCloseTo((200_147 / 770_838) * PERIOD_DAYS, 6);
    expect(PERIOD_DAYS).toBe(273);
    expect(row("T-02").salesYoy).toBeCloseTo(-0.0785, 3);
  });
  it("overdue days come from contractual due dates", () => {
    expect(row("T-03").maxOverdueDays).toBe(112);
    expect(row("P-03").maxOverdueDays).toBe(94);
    expect(row("P-02").maxOverdueDays).toBe(65);
    expect(row("P-01").maxOverdueDays).toBe(38);
    expect(row("T-01").maxOverdueDays).toBe(0);
    expect(row("T-03").notDue).toBe(99_498);
  });
  it("recurring capture comes only from accounts with installed units", () => {
    expect(row("P-01").capture).toBeCloseTo(5112 / 6766);
    expect(row("P-02").capture).toBeCloseTo(0.498, 3);
    expect(row("T-04").capture).toBeNull();
    expect(row("T-02").capture).toBeCloseTo(1954 / 2254);
  });
  it("status and reasons", () => {
    const status = Object.fromEntries(allAccountRows().map((r) => [r.seed.id, r.status.level]));
    expect(status).toEqual({ "T-01": "Healthy", "T-02": "Watch", "T-03": "At risk", "T-04": "Healthy", "P-01": "Watch", "P-02": "Watch", "P-03": "At risk", "P-04": "Healthy" });
    expect(row("T-02").status.reasons).toEqual(["Tender deadline in 10 days"]);
    expect(row("T-03").status.reasons[0]).toBe("Invoice 112 days overdue");
    expect(row("P-03").status.reasons).toEqual(["Invoice 94 days overdue", "Consumable purchases at 58% of estimated demand", "No order for 55 days"]);
  });
});

describe("segment views", () => {
  it("tender accounts", () => {
    const s = viewSummary("tender");
    expect(s).toMatchObject({ accounts: 4, sales: 2_534_272, grossProfit: 714_129, contribution: 597_578, collected: 1_973_940, outstanding: 560_332, overdue: 56_284, atRisk: 1, watch: 1, healthy: 2 });
    expect(s.margin).toBeCloseTo(0.2818, 4);
    expect(s.salesYoy).toBeCloseTo(2534.272 / 2416.57 - 1);
    expect(s.attainment).toBeCloseTo(2534.272 / 2580);
    expect(s.dso).toBeCloseTo((560_332 / 2_534_272) * 273, 6);
    expect(s.gpShare).toBeCloseTo(714_129 / 1_510_043, 6);
    expect(s.topAccountShare).toBeCloseTo(770_838 / 2_534_272);
  });
  it("private accounts", () => {
    const s = viewSummary("private");
    expect(s).toMatchObject({ accounts: 4, sales: 2_005_741, grossProfit: 795_914, contribution: 724_102, collected: 1_890_917, outstanding: 114_824, overdue: 60_783, atRisk: 1, watch: 2, healthy: 1 });
    expect(s.margin).toBeCloseTo(0.3968, 4);
    expect(s.overdueShare).toBeCloseTo(60_783 / 114_824);
  });
  it("rows are ordered by gross profit and filtered by segment", () => {
    const gp = viewRows("all").map((r) => r.grossProfit);
    expect(gp).toEqual([...gp].sort((a, b) => b - a));
    expect(viewRows("tender").every((r) => r.seed.segment === "Tender")).toBe(true);
    expect(viewRows("private").map((r) => r.seed.id)).toEqual(["P-01", "P-02", "P-04", "P-03"]);
  });
  it("tender margin is lower than private margin, as the business model implies", () => {
    expect(viewSummary("tender").margin as number).toBeLessThan(viewSummary("private").margin as number);
  });
});

describe("tender board", () => {
  const b = tenderBoard();
  it("pipeline, backlog and collections", () => {
    expect(b.pipeline.count).toBe(2);
    expect(b.pipeline.value).toBe(441_170);
    expect(b.pipeline.plannedMargin).toBeCloseTo(0.22016, 5);
    expect(b.delivering).toEqual({ count: 1, backlogToDeliver: 249_535 });
    expect(b.collecting.invoicedNotCollected).toBe(99_299);
    expect(b.deliveredNotInvoiced).toBe(0);
    expect(b.nextDeadline).toEqual({ id: "TN-041", days: 10 });
  });
  it("win rate excludes pending tenders", () => {
    expect(b.history.winRate).toBeCloseTo(6 / 11);
    expect(b.history.submitted).toBe(b.history.won + b.history.lost + b.history.pending);
    expect(b.history.avgWonValue).toBe(277_050);
  });
  it("row detail", () => {
    const t = b.rows.find((r) => r.id === "TN-033")!;
    expect(t).toMatchObject({ toDeliver: 0, invoicedNotCollected: 56_284, plannedProfit: 22_495.2 });
    expect(t.guarantee.daysToExpiry).toBe(63);
    expect(b.rows.find((r) => r.id === "TN-052")!.daysToDeadline).toBe(16);
  });
});

describe("private insights", () => {
  it("capture, quiet accounts and cadence", () => {
    const p = privateInsights();
    expect(p.quiet).toBe(1);
    expect(p.capture).toBeCloseTo(8333 / 13000);
    expect(p.monthlyGap).toBe(4_672);
    expect(p.unitCount).toBe(4);
    expect(p.unitsCovered).toBe(3);
    expect(p.ordersPerMonth).toBeCloseTo(117 / 9);
  });
});
