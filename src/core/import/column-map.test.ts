import { describe, expect, it } from "vitest";
import { applyMapping, columnReport, headerOf, remember, rememberedMapping, suggestColumn } from "./column-map";
import { SPECS } from "./specs";
import { validateImport } from "./validate";

const today = "2026-10-25";
const sales = (head: string) => `${head}\nI1,1,2026-01-05,C1,P1,2,100,60`;

describe("columnReport", () => {
  it("lists the required fields no heading matches and the headings nothing uses", () => {
    const r = columnReport("sales", ["Doc #", "Row", "Date", "Cust", "Item", "Qty", "Net", "Cost"]);
    expect(r.missingRequired.map((f) => f.key)).toEqual(expect.arrayContaining(["invoiceNo", "lineNo", "customerCode", "netSales"]));
    expect(r.unused).toEqual(expect.arrayContaining(["Doc #", "Row", "Cust", "Net"]));
    expect(r.ambiguous).toBe(false);
  });

  it("reports nothing missing for headings the importer already knows", () => {
    const r = columnReport("products", ["code", "name", "category"]);
    expect(r.missingRequired).toEqual([]);
    expect(r.unused).toEqual([]);
  });
});

describe("applyMapping", () => {
  const foreign = "Doc #,Row,Date,Cust,Item,Qty,Net,Cost";
  const all = { invoiceNo: "Doc #", lineNo: "Row", customerCode: "Cust", netSales: "Net" };

  it("makes an unknown file loadable by the unchanged importer", () => {
    const before = validateImport("sales", sales(foreign), { today });
    expect(before.fatal).toMatch(/Required column/);
    const mapped = validateImport("sales", applyMapping("sales", sales(foreign), all), { today });
    expect(mapped.fatal, mapped.fatal ?? "").toBeNull();
    expect(mapped.accepted).toHaveLength(1);
    expect(mapped.accepted[0]!.values.invoiceNo).toBe("I1");
    expect(mapped.accepted[0]!.values.customerCode).toBe("C1");
  });

  it("changes only the first line", () => {
    const out = applyMapping("sales", sales(foreign), all);
    expect(out.split("\n").slice(1)).toEqual(sales(foreign).split("\n").slice(1));
  });

  it("keeps the delimiter, quoting and line endings of the file", () => {
    const csv = `"Doc #";Row;Date;Cust;Item;Qty;Net;Cost\r\nI1;1;2026-01-05;C1;P1;2;100;60\r\n`;
    const out = applyMapping("sales", csv, all);
    expect(out.startsWith("invoiceNo;lineNo;")).toBe(true);
    expect(out.endsWith("\r\nI1;1;2026-01-05;C1;P1;2;100;60\r\n")).toBe(true);
    expect(validateImport("sales", out, { today }).accepted).toHaveLength(1);
  });

  it("skips a pair whose field already has a column, a heading that is not there, and an unknown field", () => {
    const csv = "invoice no,Row,line no,Date,customer code,product code,qty,net sales,cost";
    const out = applyMapping("sales", csv, { invoiceNo: "Row", lineNo: "Missing", nonsense: "Date" });
    expect(out).toBe(csv);
  });

  it("never renames a heading the importer already reads", () => {
    const csv = "invoice no,line no,Date,customer code,product code,qty,net sales,cost";
    expect(applyMapping("sales", csv, { lineNo: "invoice no" })).toBe(csv);
  });

  it("returns an unreadable header untouched", () => {
    expect(applyMapping("sales", '"open,Row', {})).toBe('"open,Row');
  });
});

describe("headerOf", () => {
  it("reads the first line only, with a BOM and semicolons", () => {
    expect(headerOf("﻿a;b;c\r\n1;2;3")).toEqual(["a", "b", "c"]);
  });
});

describe("suggestColumn", () => {
  const field = (kind: "sales" | "customers", key: string) => SPECS[kind].fields.find((f) => f.key === key)!;
  it("points at a heading that contains the field's name", () => {
    expect(suggestColumn(field("sales", "customerCode"), ["Net", "Customer Account Code"])).toBe("Customer Account Code");
  });
  it("suggests nothing when no heading looks alike", () => {
    expect(suggestColumn(field("sales", "customerCode"), ["Net", "Zzz"])).toBeNull();
  });
});

describe("remembered choices", () => {
  it("replays a saved choice on a later file and forgets it when cleared", () => {
    let saved = remember({}, "sales", "invoiceNo", "Doc #");
    expect(rememberedMapping("sales", ["Row", "doc #"], saved)).toEqual({ invoiceNo: "doc #" });
    expect(rememberedMapping("customers", ["Doc #"], saved)).toEqual({});
    saved = remember(saved, "sales", "invoiceNo", "", "Doc #");
    expect(rememberedMapping("sales", ["Doc #"], saved)).toEqual({});
  });

  it("ignores a saved field that no longer exists in the spec", () => {
    expect(rememberedMapping("sales", ["Doc #"], { sales: { doc: "retiredField" } })).toEqual({});
  });
});
