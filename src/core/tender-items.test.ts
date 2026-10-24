import { describe, expect, it } from "vitest";
import { cleanItems, itemTotals, lineTotal, parseQuantity, type ItemForm } from "./tender-items";

const row = (over: Partial<ItemForm> = {}): ItemForm => ({ itemName: "Glucose strips 50", quantity: "100", unit: "box", estimatedUnitPrice: "", ourUnitPrice: "", ...over });

describe("tender item lines", () => {
  it("reads quantities with commas and up to 3 decimals, and refuses zero, negatives and text", () => {
    expect(parseQuantity("2,500")).toBe(2500);
    expect(parseQuantity("0.250")).toBe(0.25);
    for (const bad of ["", "0", "-3", "abc", "1.2345", "1e3"]) expect(parseQuantity(bad)).toBe("invalid");
  });

  it("drops empty rows, keeps the rest in order, and treats blank prices as not known", () => {
    const r = cleanItems([row(), row({ itemName: "", quantity: "", unit: "" }), row({ itemName: "Lancets", quantity: "2000", unit: "", ourUnitPrice: "0.080" })]);
    expect(r).toEqual({
      ok: true,
      items: [
        { itemName: "Glucose strips 50", quantity: 100, unit: "box", estimatedUnitPrice: null, ourUnitPrice: null },
        { itemName: "Lancets", quantity: 2000, unit: null, estimatedUnitPrice: null, ourUnitPrice: 0.08 },
      ],
    });
  });

  it("names the line that is wrong", () => {
    expect(cleanItems([row(), row({ itemName: " ", quantity: "5" })])).toEqual({ ok: false, error: "Line 2: enter the item name." });
    expect(cleanItems([row({ quantity: "" })])).toMatchObject({ ok: false, error: expect.stringMatching(/^Line 1: the quantity/) });
    expect(cleanItems([row({ ourUnitPrice: "4.2555" })])).toMatchObject({ ok: false, error: expect.stringMatching(/^Line 1: our unit price/) });
    expect(cleanItems([row({ estimatedUnitPrice: "-1" })])).toMatchObject({ ok: false, error: expect.stringMatching(/^Line 1: the estimated unit price/) });
    expect(cleanItems([row({ unit: "x".repeat(31) })])).toMatchObject({ ok: false, error: expect.stringMatching(/unit is longer/) });
    expect(cleanItems(Array.from({ length: 201 }, () => row()))).toMatchObject({ ok: false, error: expect.stringMatching(/at most 200/) });
  });

  it("totals the lines only when every line has the price, so a partial bid is never shown as complete", () => {
    const items = (prices: (number | null)[]) => prices.map((p, i) => ({ itemName: `Item ${i}`, quantity: 10, unit: null, estimatedUnitPrice: p === null ? null : p + 1, ourUnitPrice: p }));
    expect(itemTotals(items([2, 3]))).toEqual({ count: 2, estimated: 70, bid: 50, unpriced: 0 });
    expect(itemTotals(items([2, null]))).toEqual({ count: 2, estimated: null, bid: null, unpriced: 1 });
    expect(itemTotals([])).toEqual({ count: 0, estimated: null, bid: null, unpriced: 0 });
  });

  it("rounds each line to the fils before adding, so the total equals the sum of the printed lines", () => {
    expect(lineTotal(3, 0.3335)).toBe(1.001);
    expect(lineTotal(2, null)).toBeNull();
    const t = itemTotals([
      { itemName: "A", quantity: 3, unit: null, estimatedUnitPrice: null, ourUnitPrice: 0.333 },
      { itemName: "B", quantity: 3, unit: null, estimatedUnitPrice: null, ourUnitPrice: 0.333 },
    ]);
    expect(t.bid).toBe(1.998);
  });
});
