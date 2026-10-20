import { describe, expect, it } from "vitest";
import { briefAlerts, briefSignals, trendStatus } from "./owner-brief";

describe("owner brief", () => {
  it("trend: growth good, small dip watch, big dip act, text nodata", () => {
    expect(trendStatus(0.05)).toBe("good");
    expect(trendStatus(-0.03)).toBe("watch");
    expect(trendStatus(-0.2)).toBe("act");
    expect(trendStatus("Data missing")).toBe("nodata");
    expect(trendStatus(null)).toBe("nodata");
  });
  it("overdue share thresholds and empty file", () => {
    const s = (overdue: number, total: number) => briefSignals({ receivables: { overdue, total }, stock: null }).overdue;
    expect(s(5, 100)).toBe("good");
    expect(s(10, 100)).toBe("watch");
    expect(s(25, 100)).toBe("act");
    expect(s(0, 0)).toBe("good");
    expect(briefSignals({ receivables: null, stock: null }).overdue).toBe("nodata");
  });
  it("never says act now on stock when under about 90 days of history are loaded", () => {
    const st = (reliable: boolean) => briefSignals({ receivables: null, stock: { slow: 100, total: 100, expiryLoss: 0, reliable } }).stock;
    expect(st(true)).toBe("act");
    expect(st(false)).toBe("watch");
  });

  it("stock takes the worse of slow share and expiry share", () => {
    const st = (slow: number, expiryLoss: number) => briefSignals({ receivables: null, stock: { slow, total: 100, expiryLoss } }).stock;
    expect(st(5, 1)).toBe("good");
    expect(st(20, 1)).toBe("watch");
    expect(st(5, 9)).toBe("act");
  });
  it("alerts: none when all good, serious first otherwise", () => {
    const good = briefSignals({
      salesGrowth: 0.1,
      cashGrowth: 0.1,
      receivables: { overdue: 0, total: 100 },
      stock: { slow: 0, total: 100, expiryLoss: 0 },
    });
    expect(briefAlerts(good, {})).toEqual([]);
    const bad = briefSignals({ salesGrowth: -0.02, cashGrowth: 0.1, receivables: { overdue: 50, total: 100 }, stock: null });
    const a = briefAlerts(bad, { overdue: "JOD 50" });
    expect(a.map((x) => x.topic)).toEqual(["overdue", "sales"]);
    expect(a[0].level).toBe("act");
  });
});
