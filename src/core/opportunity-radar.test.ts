import { describe, expect, it } from "vitest";
import { buildInstalledBase, type UnitInput } from "./installed-base";
import { ageYears, buildRadar, LOW_SHARE } from "./opportunity-radar";

const TODAY = "2026-10-20";
const unit = (over: Partial<UnitInput> = {}): UnitInput => ({
  code: "U1",
  name: "Analyzer",
  customerCode: "C1",
  customerName: "Hospital A",
  installedOn: "2024-01-01",
  warrantyEnd: "2028-01-01",
  service: "Active",
  expectedMonthly: 1000,
  ...over,
});
const radar = (units: UnitInput[], bought: Record<string, number> = {}) => buildRadar(buildInstalledBase(units, new Map(Object.entries(bought)), TODAY), TODAY);

describe("ageYears", () => {
  it("counts whole years and gives nothing for a missing or future date", () => {
    expect(ageYears("2021-10-20", TODAY)).toBe(5);
    expect(ageYears("2021-10-21", TODAY)).toBe(4);
    expect(ageYears(null, TODAY)).toBeNull();
    expect(ageYears("2030-01-01", TODAY)).toBeNull();
  });
});

describe("buildRadar", () => {
  it("flags a customer that buys under 70% of its estimate, and only that gap is money", () => {
    const r = radar([unit(), unit({ code: "U2", customerCode: "C2", customerName: "B" })], { C1: 600, C2: 900 });
    expect(r.signals).toMatchObject({ repeatAccounts: 1, repeatGapMonthly: 400 });
    expect(r.accounts.map((a) => a.customerCode)).toEqual(["C1"]);
    expect(LOW_SHARE).toBe(0.7);
  });

  it("does not flag a customer exactly at the threshold, nor one with no estimate", () => {
    expect(radar([unit()], { C1: 700 }).accounts).toEqual([]);
    expect(radar([unit({ expectedMonthly: null })], { C1: 0 }).accounts).toEqual([]);
  });

  it("counts service follow-ups in machines and keeps a missing status out of them", () => {
    const r = radar([unit({ service: "No contract", warrantyEnd: "2026-01-01" }), unit({ code: "U2", service: null }), unit({ code: "U3", service: "Expiring" })], { C1: 5000 });
    expect(r.signals).toMatchObject({ serviceUnits: 2, serviceNotRecorded: 1 });
    expect(r.accounts[0]!.units.filter((u) => u.serviceFollowUp).map((u) => u.code)).toEqual(["U1", "U3"]);
  });

  it("flags machines installed five years ago or more and counts unknown ages apart", () => {
    const r = radar([unit({ installedOn: "2020-01-01" }), unit({ code: "U2", installedOn: null }), unit({ code: "U3", installedOn: "2025-01-01" })], { C1: 5000 });
    expect(r.signals).toMatchObject({ olderUnits: 1, ageNotRecorded: 1 });
    expect(r.accounts[0]).toMatchObject({ reasons: ["older"] });
  });

  it("puts the customer with the most reasons first and never adds the signals together", () => {
    const r = radar(
      [
        unit({ installedOn: "2018-01-01", service: "No contract", warrantyEnd: "2020-01-01" }),
        unit({ code: "U2", customerCode: "C2", customerName: "B", installedOn: "2018-01-01" }),
        unit({ code: "U3", customerCode: "C3", customerName: "C", expectedMonthly: 5000 }),
      ],
      { C1: 100, C2: 5000, C3: 100 },
    );
    expect(r.accounts.map((a) => a.customerCode)).toEqual(["C1", "C3", "C2"]);
    expect(r.accounts[0]!.reasons).toEqual(["low_purchases", "service", "older"]);
    expect(Object.keys(r.signals)).not.toContain("total");
  });

  it("is empty when nothing stands out", () => {
    expect(radar([unit()], { C1: 1000 })).toMatchObject({ accounts: [], signals: { repeatAccounts: 0, serviceUnits: 0, olderUnits: 0 } });
  });
});
