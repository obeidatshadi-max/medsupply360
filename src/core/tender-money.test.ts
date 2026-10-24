import { describe, expect, it } from "vitest";
import { addDays, collectionBlocker, dueState, effectiveDueDate, receivableAging, guaranteeExposure, guaranteeState, paymentSummary } from "./tender-money";

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

describe("payment due dates", () => {
  it("adds whole days across month ends and leap years", () => {
    expect(addDays("2026-09-14", 60)).toBe("2026-11-13");
    expect(addDays("2027-12-20", 30)).toBe("2028-01-19");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-10-01", 0)).toBe("2026-10-01");
  });

  it("uses the typed due date first, then invoice date + terms, else nothing", () => {
    expect(effectiveDueDate({ invoiceDate: "2026-09-14", dueDate: "2026-10-05" }, 60)).toBe("2026-10-05");
    expect(effectiveDueDate({ invoiceDate: "2026-09-14", dueDate: null }, 60)).toBe("2026-11-13");
    expect(effectiveDueDate({ invoiceDate: "2026-09-14", dueDate: null }, 0)).toBe("2026-09-14");
    expect(effectiveDueDate({ invoiceDate: "2026-09-14", dueDate: null }, null)).toBeNull();
  });

  it("calls an invoice overdue from the day after its due date, never when it is paid", () => {
    const inv = (collected: number, dueDate: string | null) => ({ amount: 100, collected, dueDate });
    expect(dueState(inv(0, "2026-10-08"), "2026-10-08")).toEqual({ state: "not-due", daysLeft: 0 });
    expect(dueState(inv(0, "2026-10-08"), "2026-10-09")).toEqual({ state: "overdue", daysAgo: 1 });
    expect(dueState(inv(0, "2026-10-20"), "2026-10-08")).toEqual({ state: "not-due", daysLeft: 12 });
    expect(dueState(inv(100, "2026-01-01"), "2026-10-08")).toEqual({ state: "paid" });
    expect(dueState(inv(0, null), "2026-10-08")).toEqual({ state: "unknown" });
  });

  it("splits the unpaid money into overdue, not yet due and no due date, and the parts add up to the unpaid total", () => {
    const rows = [
      { amount: 1000, collected: 400, dueDate: "2026-09-01" }, // 600 overdue (part-paid)
      { amount: 500, collected: 0, dueDate: "2026-10-30" }, // 500 not yet due
      { amount: 250.5, collected: 0, dueDate: null }, // 250.5 unknown
      { amount: 800, collected: 800, dueDate: "2026-01-01" }, // paid: ignored
      { amount: 300, collected: 0, dueDate: "2026-09-20" }, // 300 overdue
    ];
    const a = receivableAging(rows, "2026-10-08");
    expect(a).toEqual({ notYetDue: 500, overdue: 900, noDueDate: 250.5, overdueInvoices: 2, oldestOverdueDays: 37 });
    expect(a.notYetDue + a.overdue + a.noDueDate).toBe(paymentSummary(rows).outstanding);
  });

  it("reports nothing overdue as null days, not zero", () => {
    expect(receivableAging([{ amount: 10, collected: 0, dueDate: "2026-12-01" }], "2026-10-08")).toMatchObject({ overdue: 0, overdueInvoices: 0, oldestOverdueDays: null });
    expect(receivableAging([], "2026-10-08")).toEqual({ notYetDue: 0, overdue: 0, noDueDate: 0, overdueInvoices: 0, oldestOverdueDays: null });
  });
});
