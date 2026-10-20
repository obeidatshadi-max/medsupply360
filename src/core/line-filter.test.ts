import { describe, expect, it } from "vitest";
import { ALL_LINES, LINE_OPTIONS, choiceOf, parseLine, salesForLine, unitInLine } from "./line-filter";
import { buildSalesByLine, type LineSums } from "./sales-by-line";

const sums: LineSums[] = [
  { line: "Equipment", period: "current", sales: 1000, costedSales: 1000, cost: 600, linesWithoutCost: 0 },
  { line: "Consumables", period: "current", sales: 500, costedSales: 500, cost: 200, linesWithoutCost: 0 },
  { line: "Consumables", period: "prior", sales: 250, costedSales: 250, cost: 100, linesWithoutCost: 0 },
];

describe("line choice", () => {
  it("offers All lines and the three lines, in the demo's order", () => {
    expect([...LINE_OPTIONS]).toEqual(["All lines", "Equipment", "Devices", "Consumables"]);
  });
  it("reads a line, and treats anything else as every line", () => {
    expect(parseLine("Devices")).toBe("Devices");
    for (const v of ["All lines", "devices", "", undefined, null, 5, "Equipment; drop"]) expect(parseLine(v)).toBeNull();
    expect(choiceOf(null)).toBe(ALL_LINES);
    expect(choiceOf("Equipment")).toBe("Equipment");
  });
});

describe("salesForLine", () => {
  const sales = buildSalesByLine(sums);
  it("leaves every line alone for All lines", () => {
    expect(salesForLine(sales, null)).toBe(sales);
  });
  it("makes the chosen line the headline and the only row", () => {
    const c = salesForLine(sales, "Consumables");
    expect(c.lines).toHaveLength(1);
    expect(c.total).toMatchObject({ line: "Total", sales: 500, priorSales: 250 });
    expect(c.total.growth).toBe(1);
  });
  it("shows a line with no sales as zero, not as the company total", () => {
    expect(salesForLine(sales, "Devices").total.sales).toBe(0);
  });
});

describe("unitInLine", () => {
  it("keeps units of the chosen line, and unknown-line units only under All lines", () => {
    expect(unitInLine("Equipment", "Equipment")).toBe(true);
    expect(unitInLine("Devices", "Equipment")).toBe(false);
    expect(unitInLine(null, "Equipment")).toBe(false);
    expect(unitInLine(null, null)).toBe(true);
  });
});
