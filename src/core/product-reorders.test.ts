import { describe, expect, it } from "vitest";
import { buildProductReorders, evaluateProductReorders, type ProductOrder } from "./product-reorders";

const dates = ["2026-01-01", "2026-01-31", "2026-03-02", "2026-04-01"];
const order = (date: string, overrides: Partial<ProductOrder> = {}): ProductOrder => ({
  customerCode: "C1", customerName: "Clinic", productCode: "P1", productName: "Reagent",
  category: "Consumables", segment: "Private", date, quantity: 10, value: 100, unit: "pack", ...overrides,
});
const history = dates.map((d) => order(d));

describe("customer/product reorder baseline", () => {
  it("keeps a missed product reorder visible when the customer buys another product", () => {
    const r = buildProductReorders([...history, order("2026-05-16", { productCode: "P2" })], "2026-05-17");
    expect(r.eligiblePairs).toBe(1);
    expect(r.insufficientHistory).toBe(1);
    expect(r.items[0]).toMatchObject({ productCode: "P1", typicalQuantity: 10, forecast: { expectedNext: "2026-05-01", level: "Overdue" } });
  });
  it("combines order-day quantities while keeping returns and future orders out", () => {
    const r = buildProductReorders([...history, ...history, order("2026-04-02", { quantity: -100, value: -1000 }), order("2027-01-01")], "2026-04-10");
    expect(r.items[0]).toMatchObject({ typicalQuantity: 20, averageOrder: 200, forecast: { orders: 4, cycleDays: 30 } });
  });
  it("withholds tender, equipment and unclassified histories", () => {
    const r = buildProductReorders([
      ...history.map((r) => ({ ...r, segment: "Tender" })),
      ...history.map((r) => ({ ...r, category: "Equipment" })),
      ...history.map((r) => ({ ...r, segment: null })),
    ], "2026-04-10");
    expect(r.items).toEqual([]);
    expect(r.excluded).toMatchObject({ tender: 4, nonConsumable: 4, unclassified: 4 });
  });
});

describe("rolling benchmark", () => {
  it("uses only earlier orders to predict a completed window", () => {
    const r = evaluateProductReorders([...history, order("2026-05-02")], ["2026-04-15", "2026-05-15"], "2026-05-15", 30);
    expect(r).toMatchObject({ windows: 1, evaluated: 1, predicted: 1, actual: 1, hits: 1, precision: 1, recall: 1, timingMaeDays: 1 });
  });
  it("does not learn from later imports and reports no denominator as unknown", () => {
    const rows = [...history, order("2026-05-02")].map((r) => ({ ...r, availableOn: "2026-05-10" }));
    expect(evaluateProductReorders(rows, ["2026-04-15"], "2026-05-15")).toMatchObject({ evaluated: 0, precision: null, recall: null, timingMaeDays: null, availability: "import-date-aware" });
  });
  it("counts missed reorders separately from timing error and ignores a return as an outcome", () => {
    const second = history.map((r) => ({ ...r, customerCode: "C2" }));
    const result = evaluateProductReorders([...history, ...second, order("2026-05-02"), order("2026-05-03", { customerCode: "C2", quantity: -2, value: -20 })], ["2026-04-15"], "2026-05-15");
    expect(result).toMatchObject({ evaluated: 2, predicted: 2, actual: 1, hits: 1, precision: 0.5, timingCases: 1 });
  });
});
