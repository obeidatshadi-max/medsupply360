import { describe, expect, it } from "vitest";
import { buildInstalledBase, recoveryScenario, unitFlags, type UnitInput } from "./installed-base";

const TODAY = "2026-10-20";
const unit = (over: Partial<UnitInput> = {}): UnitInput => ({
  code: "U1",
  name: "Analyzer",
  customerCode: "C1",
  customerName: "Hospital A",
  installedOn: "2024-01-01",
  warrantyEnd: "2028-01-01",
  service: "Active",
  expectedMonthly: 400,
  ...over,
});

describe("buildInstalledBase", () => {
  it("compares a customer's combined estimates with what the customer bought", () => {
    const r = buildInstalledBase([unit(), unit({ code: "U2", expectedMonthly: 600 })], new Map([["C1", 700]]), TODAY);
    expect(r.accounts).toHaveLength(1);
    expect(r.accounts[0]).toMatchObject({ expectedMonthly: 1000, actualMonthly: 700, gapMonthly: 300 });
    expect(r.accounts[0]!.share).toBeCloseTo(0.7);
    expect(r.totals).toMatchObject({ units: 2, customers: 1, expectedMonthly: 1000, actualMonthly: 700, gapMonthly: 300 });
  });

  it("never turns over-buying into a negative gap, and does not let it hide another customer's gap", () => {
    const r = buildInstalledBase([unit(), unit({ code: "U2", customerCode: "C2", customerName: "Clinic B" })], new Map([["C1", 900], ["C2", 100]]), TODAY);
    expect(r.accounts.find((a) => a.customerCode === "C1")).toMatchObject({ gapMonthly: 0 });
    expect(r.totals.gapMonthly).toBe(300);
    expect(r.totals.actualMonthly).toBe(1000);
  });

  it("lists a customer without any estimate but leaves it out of the money totals", () => {
    const r = buildInstalledBase([unit(), unit({ code: "U2", customerCode: "C2", customerName: "Clinic B", expectedMonthly: null })], new Map([["C1", 100], ["C2", 5000]]), TODAY);
    expect(r.accounts.map((a) => a.customerCode)).toEqual(["C1", "C2"]);
    expect(r.accounts[1]).toMatchObject({ expectedMonthly: null, share: null, gapMonthly: null });
    expect(r.totals).toMatchObject({ customers: 2, customersWithEstimate: 1, expectedMonthly: 400, actualMonthly: 100, gapMonthly: 300, unitsWithoutEstimate: 1 });
  });

  it("puts the biggest gap first", () => {
    const r = buildInstalledBase(
      [unit({ customerCode: "A", customerName: "A", expectedMonthly: 100 }), unit({ code: "U2", customerCode: "B", customerName: "B", expectedMonthly: 900 })],
      new Map(),
      TODAY,
    );
    expect(r.accounts.map((a) => a.customerCode)).toEqual(["B", "A"]);
  });

  it("treats a customer that bought nothing as buying zero", () => {
    expect(buildInstalledBase([unit()], new Map(), TODAY).accounts[0]).toMatchObject({ actualMonthly: 0, share: 0, gapMonthly: 400 });
  });
});

describe("unitFlags", () => {
  it("flags an ended warranty, and a missing service contract after it", () => {
    expect(unitFlags(unit({ warrantyEnd: "2026-06-01", service: "No contract" }), TODAY).map((f) => f.kind)).toEqual(["warranty_ended", "service"]);
    expect(unitFlags(unit({ warrantyEnd: "2026-06-01", service: "Active" }), TODAY).map((f) => f.kind)).toEqual(["warranty_ended"]);
    expect(unitFlags(unit({ warrantyEnd: "2026-06-01", service: null }), TODAY).map((f) => f.kind)).toEqual(["warranty_ended", "service"]);
  });

  it("warns 90 days ahead, not earlier, and says nothing when no date is known", () => {
    expect(unitFlags(unit({ warrantyEnd: "2026-12-01" }), TODAY)).toEqual([{ kind: "warranty_soon", text: "Warranty ends in 42 days" }]);
    expect(unitFlags(unit({ warrantyEnd: "2027-03-01" }), TODAY)).toEqual([]);
    expect(unitFlags(unit({ warrantyEnd: null, service: null }), TODAY)).toEqual([]);
  });

  it("flags an expiring service contract", () => {
    expect(unitFlags(unit({ service: "Expiring" }), TODAY)).toEqual([{ kind: "service", text: "Service contract expiring" }]);
  });

  it("lists units that need attention with their customer", () => {
    const r = buildInstalledBase([unit({ warrantyEnd: "2026-01-01", service: "No contract" })], new Map(), TODAY);
    expect(r.attention).toHaveLength(1);
    expect(r.attention[0]!.customerName).toBe("Hospital A");
  });
});

describe("recoveryScenario", () => {
  it("turns a share of the monthly gap into a year of revenue and profit", () => {
    expect(recoveryScenario(1000, 0.4, 0.25)).toEqual({ annualRevenue: 4800, annualProfit: 1200 });
  });
  it("keeps shares between 0 and 1", () => {
    expect(recoveryScenario(1000, 5, 2)).toEqual({ annualRevenue: 12000, annualProfit: 12000 });
    expect(recoveryScenario(1000, -1, 0.3)).toEqual({ annualRevenue: 0, annualProfit: 0 });
  });
});
