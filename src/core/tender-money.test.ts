import { describe, expect, it } from "vitest";
import { collectionBlocker, guaranteeExposure, guaranteeState, paymentSummary } from "./tender-money";

describe("guaranteeState", () => {
  it("is active until the day after its expiry date and counts plain days", () => {
    expect(guaranteeState({ expiresOn: "2026-10-25", returnedOn: null }, "2026-10-18")).toEqual({ state: "active", daysLeft: 7 });
    expect(guaranteeState({ expiresOn: "2026-10-18", returnedOn: null }, "2026-10-18")).toEqual({ state: "active", daysLeft: 0 });
    expect(guaranteeState({ expiresOn: "2026-10-17", returnedOn: null }, "2026-10-18")).toEqual({ state: "expired", daysAgo: 1 });
  });

  it("calls a returned guarantee returned, even past its expiry", () => {
    expect(guaranteeState({ expiresOn: "2026-01-01", returnedOn: "2026-02-01" }, "2026-10-18")).toEqual({ state: "returned" });
  });
});

describe("guaranteeExposure", () => {
  it("adds active guarantees and reports expired, unreturned ones apart", () => {
    const rows = [
      { amount: 5000, expiresOn: "2026-12-01", returnedOn: null },
      { amount: 2500.5, expiresOn: "2026-09-01", returnedOn: null },
      { amount: 9999, expiresOn: "2026-09-01", returnedOn: "2026-09-15" },
      { amount: 1000, expiresOn: "2026-10-18", returnedOn: null },
    ];
    expect(guaranteeExposure(rows, "2026-10-18")).toEqual({ active: 6000, expiredNotReturned: 2500.5 });
  });

  it("is zero with no guarantees", () => {
    expect(guaranteeExposure([], "2026-10-18")).toEqual({ active: 0, expiredNotReturned: 0 });
  });
});

describe("paymentSummary", () => {
  it("totals invoiced, collected and outstanding", () => {
    expect(paymentSummary([{ amount: 1000, collected: 400 }, { amount: 500.25, collected: 500.25 }])).toEqual({ invoiced: 1500.25, collected: 900.25, outstanding: 600, fullyCollected: false });
  });

  it("never counts more than the invoice amount as collected", () => {
    expect(paymentSummary([{ amount: 100, collected: 150 }])).toMatchObject({ collected: 100, outstanding: 0, fullyCollected: true });
  });

  it("is not fully collected when nothing was invoiced", () => {
    expect(paymentSummary([])).toEqual({ invoiced: 0, collected: 0, outstanding: 0, fullyCollected: false });
  });

  it("avoids floating point drift on fils", () => {
    expect(paymentSummary([{ amount: 0.1, collected: 0 }, { amount: 0.2, collected: 0 }]).outstanding).toBe(0.3);
  });
});

describe("collectionBlocker", () => {
  it("blocks Collected until there is an invoice and it is paid in full", () => {
    expect(collectionBlocker([])).toBe("record at least one invoice");
    expect(collectionBlocker([{ amount: 1000, collected: 400.5 }])).toBe("collect the remaining JOD 599.500 on the invoices");
    expect(collectionBlocker([{ amount: 1000, collected: 1000 }])).toBeNull();
  });
});
