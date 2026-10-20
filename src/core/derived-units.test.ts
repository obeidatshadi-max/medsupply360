import { describe, expect, it } from "vitest";
import { MAX_MACHINES_PER_GROUP, deriveUnits, derivedCode, earlierMonthlyNorm, isDerivedCode, mergeUnits, type SoldGroup } from "./derived-units";
import type { UnitInput } from "./installed-base";

const group = (over: Partial<SoldGroup> = {}): SoldGroup => ({ customerCode: "C1", customerName: "Hospital A", productCode: "P3", productName: "Analyzer", line: "Equipment", netQuantity: 2, firstSale: "2024-03-01", ...over });
const manual = (over: Partial<UnitInput> = {}): UnitInput => ({ code: "M1", name: "Analyzer", customerCode: "C1", customerName: "Hospital A", productCode: "P3", installedOn: "2023-01-01", warrantyEnd: "2025-01-01", service: "Active", expectedMonthly: 400, ...over });

describe("deriveUnits", () => {
  it("makes one machine per unit sold, dated by the first sale, with warranty and service unrecorded", () => {
    const u = deriveUnits([group()]);
    expect(u.map((x) => x.code)).toEqual(["ERP-C1-P3-1", "ERP-C1-P3-2"]);
    expect(u[0]).toMatchObject({ name: "Analyzer", line: "Equipment", source: "erp", installedOn: "2024-03-01", warrantyEnd: null, service: null, expectedMonthly: null, productCode: "P3" });
  });
  it("leaves out a product returned in full, and a negative or zero quantity", () => {
    expect(deriveUnits([group({ netQuantity: 0 }), group({ netQuantity: -2 })])).toEqual([]);
  });
  it("rounds a fractional quantity down and caps one group", () => {
    expect(deriveUnits([group({ netQuantity: 2.9 })])).toHaveLength(2);
    expect(deriveUnits([group({ netQuantity: 5000 })])).toHaveLength(MAX_MACHINES_PER_GROUP);
  });
  it("recognises its own codes", () => {
    expect(isDerivedCode(derivedCode("C1", "P3", 1))).toBe(true);
    expect(isDerivedCode("U1")).toBe(false);
  });
});

describe("mergeUnits", () => {
  const derived = deriveUnits([group({ netQuantity: 3 })]);

  it("lets a described machine replace the derived one with the same code", () => {
    const m = mergeUnits(derived, [manual({ code: "ERP-C1-P3-2" })]);
    expect(m).toHaveLength(3);
    expect(m.find((u) => u.code === "ERP-C1-P3-2")).toMatchObject({ source: "manual", service: "Active", warrantyEnd: "2025-01-01" });
  });
  it("otherwise replaces one derived machine of the same customer and product", () => {
    const m = mergeUnits(derived, [manual()]);
    expect(m).toHaveLength(3);
    expect(m.filter((u) => u.source === "erp")).toHaveLength(2);
    expect(m.filter((u) => u.source === "manual")).toHaveLength(1);
  });
  it("adds a described machine that has no derived twin", () => {
    const m = mergeUnits(derived, [manual({ code: "X1", customerCode: "C9", customerName: "Elsewhere", productCode: "P9" }), manual({ code: "X2", productCode: null })]);
    expect(m).toHaveLength(5);
  });
  it("is the derived list when nothing is described", () => {
    expect(mergeUnits(derived, [])).toHaveLength(3);
  });
});

describe("earlierMonthlyNorm", () => {
  it("averages over the whole span, only for customers who bought in enough months", () => {
    const n = earlierMonthlyNorm([
      { customerCode: "C1", sales: 900, monthsWithSales: 6 },
      { customerCode: "C2", sales: 900, monthsWithSales: 2 },
      { customerCode: "C3", sales: 0, monthsWithSales: 5 },
    ]);
    expect(n.get("C1")).toBe(100);
    expect(n.has("C2")).toBe(false);
    expect(n.has("C3")).toBe(false);
  });
});
