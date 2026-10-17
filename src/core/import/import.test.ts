import { describe, expect, it } from "vitest";
import { CsvError, detectDelimiter, parseCsv } from "./csv";
import { bool, date, days, money, normalizeDigits, positiveDecimal } from "./parsers";
import { validateImport } from "./validate";

const TODAY = "2026-10-09";
const run = (kind: Parameters<typeof validateImport>[0], text: string, snapshotDate?: string) =>
  validateImport(kind, text, { today: TODAY, snapshotDate });

describe("ambiguous source columns", () => {
  it("shows the exact source columns used in a valid file", () => {
    const r = run("products", "Item Code,Name,Category\nP1,Gloves,Consumables");
    expect(r.fatal).toBeNull();
    expect(r.mappedColumns).toContainEqual({ field: "code", sourceColumn: "Item Code" });
  });
  it("blocks aliases and duplicate normalized headers instead of choosing the first", () => {
    for (const header of ["code,product code,name,category", "code,CODE,name,category"]) {
      const r = run("products", `${header}\nP1,P2,Gloves,Consumables`);
      expect(r.fatal).toMatch(/Ambiguous columns.*code/);
      expect(r.accepted).toEqual([]);
    }
  });
});

describe("parseCsv", () => {
  it("reads quotes, embedded delimiters, quotes and line breaks, and CRLF", () => {
    const { records } = parseCsv('a,b,c\r\n"x, y","say ""hi""","line1\nline2"\r\n');
    expect(records).toEqual([["a", "b", "c"], ["x, y", 'say "hi"', "line1\nline2"]]);
  });

  it("strips a BOM and keeps Arabic text", () => {
    const { records } = parseCsv("﻿اسم,city\nصيدلية الأمل,Amman");
    expect(records[0][0]).toBe("اسم");
    expect(records[1][0]).toBe("صيدلية الأمل");
  });

  it("detects semicolon and tab delimiters, defaulting to comma", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a\tb\tc")).toBe("\t");
    expect(detectDelimiter("single")).toBe(",");
  });

  it("keeps blank records so record N is spreadsheet row N", () => {
    expect(parseCsv("a,b\n\n1,2").records).toEqual([["a", "b"], [""], ["1", "2"]]);
  });

  it("refuses an unclosed quote", () => {
    expect(() => parseCsv('a,b\n"oops,1')).toThrow(CsvError);
  });
});

describe("parsers", () => {
  it("reads day-first, ISO and slashed dates, and rejects impossible ones", () => {
    expect(date("2026-03-05")).toEqual({ ok: true, value: "2026-03-05", warning: undefined });
    expect(date("5/3/2026")).toMatchObject({ ok: true, value: "2026-03-05" });
    expect(date("05.03.2026 14:30")).toMatchObject({ ok: true, value: "2026-03-05" });
    expect(date("٠٥/٠٣/٢٠٢٦")).toMatchObject({ ok: true, value: "2026-03-05" });
    expect(date("30/02/2026").ok).toBe(false);
    expect(date("March 5").ok).toBe(false);
  });

  it("reads money to fils as text, with signs, thousands separators and Arabic digits", () => {
    expect(money("1,234.5")).toMatchObject({ value: "1234.500" });
    expect(money("(12.5)")).toMatchObject({ value: "-12.500" });
    expect(money("-12.5")).toMatchObject({ value: "-12.500" });
    expect(money("12.5-")).toMatchObject({ value: "-12.500" });
    expect(money("١٢٫٥")).toMatchObject({ value: "12.500" });
    expect(money("-0.0001")).toMatchObject({ value: "0.000" });
  });

  it("refuses ambiguous or unreadable numbers instead of guessing", () => {
    expect(money("1234,5").ok).toBe(false);
    expect(money("12 JOD").ok).toBe(false);
    expect(money("abc").ok).toBe(false);
    expect(money("1e12").ok).toBe(false);
    expect(positiveDecimal("0").ok).toBe(false);
  });

  it("reads payment terms and yes/no words", () => {
    expect(days("Net 90")).toMatchObject({ value: 90 });
    expect(days("soon").ok).toBe(false);
    expect(bool("Yes")).toMatchObject({ value: true });
    expect(bool("لا")).toMatchObject({ value: false });
    expect(bool("maybe").ok).toBe(false);
  });

  it("normalises Arabic digits", () => {
    expect(normalizeDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
  });
});

describe("validateImport: file level", () => {
  it("rejects the file when a required column is missing and names what was found", () => {
    const r = run("products", "Product Code,Product Name\nP1,Gloves");
    expect(r.fatal).toMatch(/Required column.*category/i);
    expect(r.fatal).toMatch(/Found: Product Code, Product Name/);
    expect(r.accepted).toEqual([]);
  });

  it("rejects an empty file and an unclosed quote", () => {
    expect(run("products", "").fatal).toMatch(/empty/);
    expect(run("products", 'code,name,category\n"P1,x').fatal).toMatch(/never closed/);
  });

  it("matches headers ignoring case, spacing and punctuation, and lists ignored columns", () => {
    const r = run("products", "ITEM_CODE;Item Name;Product Category;Colour\nP1;Gloves;Consumables;Blue");
    expect(r.fatal).toBeNull();
    expect(r.delimiter).toBe(";");
    expect(r.accepted[0].values).toMatchObject({ code: "P1", name: "Gloves", line: "Consumables", tracksExpiry: false, active: true });
    expect(r.ignoredColumns).toEqual(["Colour"]);
  });

  it("enforces the row limit", () => {
    const rows = Array.from({ length: 6 }, (_, i) => `P${i},x,Devices`).join("\n");
    expect(validateImport("products", `code,name,category\n${rows}`, { today: TODAY, maxRows: 5 }).fatal).toMatch(/limit is 5/);
  });
});

describe("validateImport: products and customers", () => {
  it("accepts good rows, rejects bad ones with the spreadsheet row number, and counts everything", () => {
    const r = run(
      "products",
      ["code,name,category,pack conversion", "P1,Gloves,Consumables,10", "P2,Mystery,Gadgets,1", "P1,Dup,Devices,", ",NoCode,Devices,", "P3,Zero pack,Equipment,0"].join("\n"),
    );
    expect(r.rowsTotal).toBe(5);
    expect(r.accepted.map((a) => a.row)).toEqual([2]);
    expect(r.rejected).toEqual([
      { row: 3, reason: 'category: unrecognised product category: "Gadgets"' },
      { row: 4, reason: "duplicate of row 2 in this file" },
      { row: 5, reason: "product code is empty" },
      { row: 6, reason: 'pack conversion: must be greater than zero: "0"' },
    ]);
  });

  it("keeps blank optional values unknown, not zero", () => {
    const r = run("customers", "code,name,payment terms,credit limit,segment\nC1,Clinic,,,");
    expect(r.accepted[0].values).toMatchObject({ paymentTermsDays: null, creditLimit: null, segment: null });
  });

  it("maps public-sector wording to Tender and leaves unrecognised segments unknown with a warning", () => {
    const r = run("customers", "code,name,segment\nC1,Ministry,Government\nC2,Shop,Private\nC3,Odd,Wholesale");
    expect(r.accepted.map((a) => a.values.segment)).toEqual(["Tender", "Private", null]);
    expect(r.warnings).toEqual([{ row: 4, reason: expect.stringContaining('unrecognised customer segment "Wholesale"') }]);
  });
});

describe("validateImport: sales", () => {
  const header = "invoice no,line no,date,customer code,product code,qty,net sales,cost";

  it("derives the document type from the sign when there is no type column", () => {
    const r = run("sales", `${header}\nI1,1,2026-09-01,C1,P1,5,100,60\nI1,2,2026-09-01,C1,P1,-1,-20,-12`);
    expect(r.accepted.map((a) => a.values.docType)).toEqual(["invoice", "return"]);
    expect(r.accepted[1].values).toMatchObject({ quantity: "-1.000", netSales: "-20.000", productCost: "-12.000" });
  });

  it("rejects a return written with a positive quantity, a future date and a duplicate line", () => {
    const r = run(
      "sales",
      `${header},type\nI1,1,2026-09-01,C1,P1,5,100,60,return\nI2,1,2026-12-01,C1,P1,5,100,60,invoice\nI3,1,2026-09-01,C1,P1,5,100,60,invoice\nI3,1,2026-09-02,C1,P1,5,100,60,invoice`,
    );
    expect(r.accepted.map((a) => a.row)).toEqual([4]);
    expect(r.rejected.map((x) => x.reason)).toEqual([
      "a return must have a negative quantity",
      expect.stringContaining("is after today"),
      "duplicate of row 4 in this file",
    ]);
  });

  it("reads an optional due date, keeps a missing one unknown, and rejects one before the invoice date", () => {
    const r = run(
      "sales",
      `${header},due date
I1,1,2026-09-01,C1,P1,5,100,60,2026-10-01
I2,1,2026-09-01,C1,P1,5,100,60,
I3,1,2026-09-01,C1,P1,5,100,60,2026-08-01`,
    );
    expect(r.accepted.map((a) => a.values.dueDate)).toEqual(["2026-10-01", null]);
    expect(r.rejected).toEqual([{ row: 4, reason: "due date is before the invoice date" }]);
  });

  it("treats a missing cost as unknown, not zero", () => {
    const r = run("sales", "invoice no,line no,date,customer code,product code,qty,net sales\nI1,1,2026-09-01,C1,P1,5,100");
    expect(r.accepted[0].values.productCost).toBeNull();
  });
});

describe("validateImport: receipts", () => {
  const header = "receipt no,allocation row id,date,customer code,invoice no,allocated,receipt total";

  it("accepts allocations that add up to the receipt total and allows unapplied cash", () => {
    const r = run("receipts", `${header}\nR1,1,2026-09-01,C1,I1,600,1000\nR1,2,2026-09-01,C1,,400,1000`);
    expect(r.accepted).toHaveLength(2);
    expect(r.accepted[1].values.invoiceNo).toBeNull();
  });

  it("rejects every row of a receipt whose allocations do not add up", () => {
    const r = run("receipts", `${header}\nR1,1,2026-09-01,C1,I1,600,1000\nR1,2,2026-09-01,C1,I2,300,1000\nR2,1,2026-09-01,C1,I3,50,50`);
    expect(r.accepted.map((a) => a.values.receiptNo)).toEqual(["R2"]);
    expect(r.rejected).toHaveLength(2);
    expect(r.rejected[0].reason).toMatch(/add to 900\.000 but the receipt total is 1000\.000/);
  });
});

describe("validateImport: snapshots", () => {
  const open = "invoice no,customer code,invoice date,due date,remaining";

  it("needs a snapshot date from a column or the upload form", () => {
    const text = `${open}\nI1,C1,2026-06-01,2026-08-30,500`;
    expect(run("open_invoices", text).fatal).toMatch(/no snapshot date/);
    expect(run("open_invoices", text, "2026-10-08")).toMatchObject({ fatal: null, snapshotDate: "2026-10-08" });
  });

  it("uses a snapshot date column and rejects rows from another date", () => {
    const r = run("open_invoices", `snapshot date,${open}\n2026-10-08,I1,C1,2026-06-01,2026-08-30,500\n2026-10-01,I2,C1,2026-06-01,2026-08-30,70`);
    expect(r.snapshotDate).toBe("2026-10-08");
    expect(r.accepted.map((a) => a.values.invoiceNo)).toEqual(["I1"]);
    expect(r.rejected[0].reason).toMatch(/differs from the file's snapshot date/);
  });

  it("rejects a future snapshot, a due date before the invoice date, and keeps a missing due date unknown", () => {
    expect(run("open_invoices", `${open}\nI1,C1,2026-06-01,2026-08-30,500`, "2026-12-01").fatal).toMatch(/future/);
    const r = run("open_invoices", `${open}\nI1,C1,2026-06-01,2026-05-01,500\nI2,C1,2026-06-01,,70`, "2026-10-08");
    expect(r.rejected).toEqual([{ row: 2, reason: "due date is before the invoice date" }]);
    expect(r.accepted[0].values.dueDate).toBeNull();
  });

  it("reads stock by batch with ownership and defaults a missing batch to the empty string", () => {
    const r = run(
      "stock_snapshot",
      "product code,warehouse,batch,qty,unit cost,expiry,ownership\nP1,Main,B1,10,2.5,2027-01-31,Owned\nP2,Main,,4,,,Consignment",
      "2026-10-08",
    );
    expect(r.accepted.map((a) => a.values)).toMatchObject([
      { batch: "B1", unitCost: "2.500", expiryDate: "2027-01-31", owned: true },
      { batch: "", unitCost: null, expiryDate: null, owned: false },
    ]);
  });
});

describe("validateImport: stock transactions and installed units", () => {
  it("refuses an unknown transaction type so a transfer is never read as demand", () => {
    const r = run(
      "stock_transactions",
      "transaction id,date,product code,warehouse,type,qty\nT1,2026-09-01,P1,Main,Issue,-5\nT2,2026-09-01,P1,Main,Write-off,-1\nT3,2026-09-01,P1,Main,Transfer,-2",
    );
    expect(r.accepted.map((a) => a.values.txType)).toEqual(["customer_issue", "transfer"]);
    expect(r.rejected).toEqual([{ row: 3, reason: 'transaction type: unrecognised transaction type: "Write-off"' }]);
  });

  it("rejects a warranty that ends before installation", () => {
    const r = run("installed_units", "unit code,customer code,name,installed on,warranty end\nU1,C1,Analyzer,2025-01-01,2024-01-01\nU2,C1,Analyzer,2025-01-01,2027-01-01");
    expect(r.accepted.map((a) => a.row)).toEqual([3]);
    expect(r.rejected[0].reason).toBe("warranty ends before the installation date");
  });
});
