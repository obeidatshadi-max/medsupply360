import { describe, expect, it } from "vitest";
import { detectKind, IMPORT_ORDER } from "./detect";
import { SPECS, type ImportKind } from "./specs";

const header = (...h: string[]) => `${h.join(",")}\nrow`;

describe("detectKind", () => {
  it("recognises each export from its header", () => {
    const cases: [ImportKind, string][] = [
      ["products", header("code", "name", "category", "unit")],
      ["customers", header("code", "name", "segment", "city", "account owner")],
      ["sales", header("invoice no", "line no", "date", "customer code", "product code", "qty", "net sales", "cost")],
      ["receipts", header("receipt no", "allocation row id", "date", "customer code", "invoice no", "allocated amount", "receipt total")],
      ["open_invoices", header("invoice no", "customer code", "invoice date", "due date", "remaining")],
      ["stock_snapshot", header("product code", "warehouse", "batch", "qty", "unit cost")],
      ["stock_transactions", header("transaction id", "date", "product code", "warehouse", "type", "qty")],
      ["installed_units", header("unit code", "customer code", "name", "installed on")],
    ];
    for (const [kind, text] of cases) expect(detectKind(text), kind).toEqual({ kind, certain: true });
  });

  it("detects every spec's own field keys as that spec", () => {
    for (const kind of IMPORT_ORDER) {
      const text = header(...SPECS[kind].fields.map((f) => f.key));
      expect(detectKind(text), kind).toEqual({ kind, certain: true });
    }
  });

  it("reads semicolon files, a BOM and Windows line endings", () => {
    expect(detectKind("﻿invoice no;customer code;invoice date;remaining\r\nI1;C1;2026-01-01;5")).toEqual({ kind: "open_invoices", certain: true });
  });

  it("takes the more specific type when column counts tie", () => {
    // A code and a name only fit customers; products also needs a category.
    expect(detectKind(header("code", "name"))).toEqual({ kind: "customers", certain: true });
    // "category" is a products line and a customer type: both fit with 3 columns, products has more required fields.
    expect(detectKind(header("code", "name", "category"))).toEqual({ kind: "products", certain: true });
  });

  it("returns no type for an unknown, empty or ambiguous header", () => {
    expect(detectKind("")).toEqual({ kind: null, certain: false, candidates: [] });
    expect(detectKind(header("foo", "bar"))).toEqual({ kind: null, certain: false, candidates: [] });
    // Two source columns for one field is ambiguous for that type, so it cannot be it.
    expect(detectKind(header("code", "item code", "name", "line")).kind).not.toBe("products");
  });
});
