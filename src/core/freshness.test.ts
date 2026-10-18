import { describe, expect, it } from "vitest";
import { assessFreshness, windowEnd } from "./freshness";

const base = { today: "2026-10-18", latestInvoice: null, latestReceipt: null, openInvoicesAsOf: null, stockAsOf: null };

describe("assessFreshness", () => {
  it("calls recent data current", () => {
    const f = assessFreshness({ ...base, latestInvoice: "2026-10-17", latestReceipt: "2026-10-18", openInvoicesAsOf: "2026-10-15", stockAsOf: "2026-10-18" });
    expect(f.level).toBe("current");
    expect(f.items.find((i) => i.key === "sales")?.daysOld).toBe(1);
  });

  it("marks data aging after 10 days and stale after 31", () => {
    expect(assessFreshness({ ...base, latestInvoice: "2026-10-08" }).items[0].level).toBe("current");
    expect(assessFreshness({ ...base, latestInvoice: "2026-10-07" }).items[0].level).toBe("aging");
    expect(assessFreshness({ ...base, latestInvoice: "2026-09-17" }).items[0].level).toBe("aging");
    expect(assessFreshness({ ...base, latestInvoice: "2026-09-16" }).items[0].level).toBe("stale");
  });

  it("takes the worst level and the oldest date", () => {
    const f = assessFreshness({ ...base, latestInvoice: "2026-10-17", stockAsOf: "2026-08-01" });
    expect(f.level).toBe("stale");
    expect(f.oldestAsOf).toBe("2026-08-01");
  });

  it("does not call a file that was never imported stale", () => {
    const f = assessFreshness({ ...base, latestInvoice: "2026-10-17" });
    expect(f.level).toBe("current");
    expect(f.items.find((i) => i.key === "stock")).toMatchObject({ asOf: null, daysOld: null });
  });

  it("reports no oldest date when nothing is imported", () => {
    expect(assessFreshness(base)).toMatchObject({ level: "current", oldestAsOf: null });
  });

  it("treats a future date as 0 days old", () => {
    expect(assessFreshness({ ...base, latestInvoice: "2026-10-19" }).items[0].daysOld).toBe(0);
  });
});

describe("windowEnd", () => {
  it("stops at the latest data date", () => {
    expect(windowEnd("2026-10-18", "2026-09-30")).toBe("2026-09-30");
  });
  it("never goes past today", () => {
    expect(windowEnd("2026-10-18", "2026-10-19")).toBe("2026-10-18");
  });
  it("falls back to today with no data", () => {
    expect(windowEnd("2026-10-18", null)).toBe("2026-10-18");
  });
});
