import { describe, expect, it } from "vitest";
import { cleanPersonName, cleanSalesPerson, elapsedMonths, matchesOwner, parseOwnerFilter, targetProgress, type SalesPersonForm } from "./sales-force";

const ID = "5bf23be4-0c94-481c-b31d-1a44a8f5eb22";
const form = (over: Partial<SalesPersonForm> = {}): SalesPersonForm => ({ name: "Khaled Mansour", email: "", suppliers: [], monthlySalesTarget: "", newAccountsTarget: "", visitsPerWeek: "", ...over });

describe("cleanPersonName", () => {
  it("tidies a name and accepts Arabic", () => {
    expect(cleanPersonName("  Khaled   Mansour ")).toEqual({ ok: true, name: "Khaled Mansour" });
    expect(cleanPersonName("خالد منصور")).toEqual({ ok: true, name: "خالد منصور" });
  });

  it("refuses empty, letterless and over-long names", () => {
    for (const bad of ["", " ", "A", "12", null]) expect(cleanPersonName(bad).ok).toBe(false);
    expect(cleanPersonName("a".repeat(81)).ok).toBe(false);
  });
});

describe("cleanSalesPerson", () => {
  it("accepts a person with only a name", () => {
    expect(cleanSalesPerson(form())).toEqual({ ok: true, value: { name: "Khaled Mansour", email: null, supplierNames: [], monthlySalesTarget: null, newAccountsTarget: null, visitsPerWeek: null } });
  });

  it("reads email, suppliers and the three expectations", () => {
    const r = cleanSalesPerson(form({ email: " Khaled@Example.com ", suppliers: ["MEDIMA", " medima ", "BOWA", ""], monthlySalesTarget: "25,000.5", newAccountsTarget: "2", visitsPerWeek: "12" }));
    expect(r).toEqual({ ok: true, value: { name: "Khaled Mansour", email: "khaled@example.com", supplierNames: ["MEDIMA", "BOWA"], monthlySalesTarget: 25000.5, newAccountsTarget: 2, visitsPerWeek: 12 } });
  });

  it("refuses a bad email, target or count with a plain message", () => {
    expect(cleanSalesPerson(form({ email: "nope" })).ok).toBe(false);
    for (const bad of ["abc", "-5", "1.2345", "2000000000"]) expect(cleanSalesPerson(form({ monthlySalesTarget: bad })).ok).toBe(false);
    for (const bad of ["1.5", "-1", "x", "1001"]) expect(cleanSalesPerson(form({ newAccountsTarget: bad })).ok).toBe(false);
    expect(cleanSalesPerson(form({ visitsPerWeek: "101" })).ok).toBe(false);
  });
});

describe("target progress", () => {
  it("counts the months passed, with a fraction for the current month", () => {
    expect(elapsedMonths("2026-01-31")).toBe(1);
    expect(elapsedMonths("2026-03-15")).toBeCloseTo(2.48, 1);
    expect(elapsedMonths("2026-12-31")).toBe(12);
  });

  it("judges year-to-date sales against the target so far", () => {
    expect(targetProgress(60_000, 10_000, "2026-06-30")).toMatchObject({ status: "on", ratio: 1, expected: 60_000 });
    expect(targetProgress(45_000, 10_000, "2026-06-30").status).toBe("behind");
    expect(targetProgress(30_000, 10_000, "2026-06-30").status).toBe("far");
  });

  it("says there is no target when none is set", () => {
    expect(targetProgress(1000, null, "2026-06-30")).toEqual({ status: "none", ratio: null, expected: null });
    expect(targetProgress(1000, 0, "2026-06-30").status).toBe("none");
  });
});

describe("owner filter", () => {
  it("reads none, an id, or anything else as everyone", () => {
    expect(parseOwnerFilter("none")).toEqual({ kind: "none" });
    expect(parseOwnerFilter(ID)).toEqual({ kind: "owner", id: ID });
    expect(parseOwnerFilter("")).toEqual({ kind: "all" });
    expect(parseOwnerFilter("x'; drop table")).toEqual({ kind: "all" });
  });

  it("matches tenders by owner", () => {
    expect(matchesOwner({ kind: "all" }, null)).toBe(true);
    expect(matchesOwner({ kind: "none" }, null)).toBe(true);
    expect(matchesOwner({ kind: "none" }, ID)).toBe(false);
    expect(matchesOwner({ kind: "owner", id: ID }, ID.toUpperCase())).toBe(true);
    expect(matchesOwner({ kind: "owner", id: ID }, null)).toBe(false);
  });
});
