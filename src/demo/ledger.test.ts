import { describe, expect, it } from "vitest";
import { lines, invoices } from "./dataset";
import { demoLedger, demoPortfolio } from "./ledger";

describe("demo ledger agrees with the demo's headline figures", () => {
  const all = demoLedger();
  it("overdue is the demo's own overdue invoice total", () => {
    expect(all.aging.overdue).toBe(invoices.reduce((s, i) => s + i.value, 0));
  });
  it("aging buckets add up with the missing-due-date invoice shown apart", () => {
    const b = Object.values(all.aging.buckets).reduce((a, x) => a + x, 0);
    expect(b + all.aging.dueDateMissing.amount).toBe(all.aging.total);
    expect(all.aging.dueDateMissing).toEqual({ invoices: 1, amount: 12730 });
  });
  it("monthly cash adds up to the demo's year-to-date collections, per line and in total", () => {
    expect(all.cashJanSep).toBe(lines.reduce((s, l) => s + l.col, 0));
    for (const l of lines) expect(demoLedger(l.name).cashJanSep).toBe(l.col);
  });
  it("line filter narrows aging to that line", () => {
    expect(demoLedger("Devices").aging.overdue).toBe(28915);
  });
  it("finds overdue and lapsed reorders and leaves the thin-history customer out", () => {
    const levels = Object.fromEntries(all.opportunities.reorders.map((r) => [r.customerCode, r.forecast.level]));
    expect(levels["Dabouq Heights Private Hospital"]).toBe("Lapsed");
    expect(levels["Jabal Amman University Hospital"]).toBe("Overdue");
    expect(levels["Rawabi Wound and Diabetes Clinic"]).toBe("Overdue");
    expect(levels["Khalda Garden Private Hospital"]).toBeUndefined();
    expect(all.opportunities.customersWithoutEnoughHistory).toBe(1);
  });
  it("weekly figures come from the same orders and receipts", () => {
    const w = all.weekly;
    expect(w.sales.now).toBe(106550);
    expect(w.sales.before).toBe(49300);
    expect(w.cash.now).toBe(67755);
    expect(w.cash.before).toBe(57565);
    expect(w.overdue.before).toBeGreaterThan(0);
  });
});

describe("demo portfolio agrees with the demo's headline figures", () => {
  const p = demoPortfolio();
  const area = (n: string) => p.areas.find((a) => a.area === n)!;
  it("adds up to the demo's year-to-date sales", () => {
    expect(p.totalSales).toBe(lines.reduce((s, l) => s + l.rev, 0));
  });
  it("tells broad growth, one-customer growth, decline and stable apart", () => {
    expect(area("Respiratory").signal).toBe("Growing");
    expect(area("Infusion and critical care").signal).toBe("Growing");
    expect(area("Surgery and electrosurgery").signal).toBe("Growth comes from one customer");
    expect(area("Neurology and psychiatry").signal).toBe("Declining");
    expect(area("Wound care").signal).toBe("Stable");
  });
  it("points at growing areas with a thin range", () => {
    expect(p.lookHere.map((a) => a.area)).toEqual(["Respiratory", "Infusion and critical care"]);
  });
});
