import { describe, expect, it } from "vitest";
import { detectKind, nearestKind } from "./detect";
import { date } from "./parsers";
import { readUploadedFile } from "./read-file";
import { validateImport } from "./validate";
import { readCsvText } from "./workbook";

const today = "2026-11-04";
const SALES_HEAD = "Invoice No,Line No,Invoice Date,Customer Code,Item Code,Quantity,Net Sales";

describe("totals line", () => {
  it("does not sink a snapshot", () => {
    const csv = "Snapshot Date,Invoice No,Customer Code,Invoice Date,Due Date,Remaining Amount\n2026-11-01,I1,C1,2026-09-01,2026-10-01,10.5\n2026-11-01,I2,C1,2026-09-02,2026-10-02,5\n,Total,,,,15.5\n";
    const r = validateImport("open_invoices", csv, { today });
    expect(r.accepted).toHaveLength(2);
    expect(r.rejected).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.rowsTotal).toBe(2);
  });
  it("skips Arabic totals but keeps a customer whose name starts with Total", () => {
    const sales = validateImport("sales", `${SALES_HEAD}\nI1,1,2026-07-01,C1,P1,2,10\nالمجموع,,,,,2,10\n`, { today });
    expect(sales.accepted).toHaveLength(1);
    expect(sales.rejected).toEqual([]);
    const customers = validateImport("customers", "Customer Code,Customer Name\nC1,Total Care Pharmacy\n", { today });
    expect(customers.accepted).toHaveLength(1);
  });
});

describe("CSV with a title above the headings", () => {
  const banner = `Sadaf Medical\nSales 01/07/2026 - 31/10/2026\n\n${SALES_HEAD}\nI1,1,2026-07-01,C1,P1,2,10.5\n`;
  it("finds the headings", () => {
    const r = readCsvText(banner);
    expect(r.kind).toBe("sales");
    expect(r.headerRow).toBe(4);
    expect(validateImport("sales", r.csv, { today }).accepted).toHaveLength(1);
  });
  it("finds them in a semicolon file", () => {
    const r = readCsvText(banner.replaceAll(",", ";").replace("01/07/2026 - 31/10/2026", "x"));
    expect(r.kind).toBe("sales");
    expect(validateImport("sales", r.csv, { today }).accepted).toHaveLength(1);
  });
  it("leaves a plain file untouched", () => {
    const text = `${SALES_HEAD}\nI1,1,2026-07-01,C1,P1,2,10.5\n`;
    const r = readCsvText(text);
    expect(r).toMatchObject({ kind: "sales", headerRow: 1, rows: 1, csv: text });
  });
  it("reads a Windows-1256 CSV through the shared reader", async () => {
    const bytes = new Uint8Array([...new TextEncoder().encode("Customer Code,Customer Name\nC1,")  , 0xe3, 0xd1, 0xcd, 0xc8, 0xc7, 0x0a]);
    const [r] = await readUploadedFile("c.csv", new Blob([bytes]));
    expect(r!.kind).toBe("customers");
    expect(r!.csv).toContain("مرحبا");
  });
});

describe("dates", () => {
  it.each([
    ["05-Mar-2026", "2026-03-05"],
    ["5 March 2026", "2026-03-05"],
    ["Mar 5, 2026", "2026-03-05"],
    ["5/3/26", "2026-03-05"],
    ["20260305", "2026-03-05"],
    ["46086", "2026-03-05"],
    ["05/03/2026 02:30 PM", "2026-03-05"],
  ])("reads %s", (raw, iso) => expect(date(raw)).toMatchObject({ ok: true, value: iso }));
  it("still refuses nonsense", () => {
    expect(date("31-Foo-2026").ok).toBe(false);
    expect(date("31/02/2026").ok).toBe(false);
  });
  it("blocks a month-first file instead of swapping day and month", () => {
    const r = validateImport("sales", `${SALES_HEAD}\nI1,1,03/05/2026,C1,P1,1,1\nI2,1,05/13/2026,C1,P1,1,1\n`, { today });
    expect(r.fatal).toMatch(/month-first/);
  });
  it("accepts a day-first file, and one with no day above 12", () => {
    expect(validateImport("sales", `${SALES_HEAD}\nI1,1,03/05/2026,C1,P1,1,1\nI2,1,13/05/2026,C1,P1,1,1\n`, { today }).fatal).toBeNull();
    expect(validateImport("sales", `${SALES_HEAD}\nI1,1,03/05/2026,C1,P1,1,1\n`, { today }).fatal).toBeNull();
  });
});

describe("headings", () => {
  it("ignores a unit in brackets", () => {
    expect(detectKind("Invoice No,Line No,Invoice Date,Customer Code,Item Code,Quantity,Net Amount (JOD)")).toEqual({ kind: "sales", certain: true });
  });
  it("knows Arabic receipts and unpaid invoices", () => {
    expect(detectKind("رقم السند,رقم التخصيص,تاريخ السند,رقم العميل,المبلغ")).toEqual({ kind: "receipts", certain: true });
    expect(detectKind("رقم الفاتورة,رقم العميل,تاريخ الفاتورة,تاريخ الاستحقاق,المتبقي")).toEqual({ kind: "open_invoices", certain: true });
  });
  it("suggests the closest type when one required heading is unknown", () => {
    const head = "Invoice No,Line No,Invoice Date,Customer Code,Item Code,Qnty,Net Sales";
    expect(detectKind(head).kind).toBeNull();
    expect(nearestKind(head)).toBe("sales");
    expect(nearestKind("foo,bar,baz")).toBeNull();
  });
});

describe("report CSV that repeats its headings on every line", () => {
  // Some report tools write the labels into every record beside the values: the column under a heading then holds
  // the heading itself. Reading it as data would reject every row with a puzzling message.
  it("is refused with one clear message instead of one error per row", () => {
    const head = "Invoice No,Line No,Invoice Date,Customer Code,Item Code,Quantity,Net Sales,x1,x2";
    const line = (n: number) => `Invoice No,Line No,Invoice Date,Customer Code,Item Code,Quantity,Net Sales,I${n},0${n}/10/2026`;
    const r = validateImport("sales", [head, line(1), line(2), line(3)].join("\n"), { today });
    expect(r.fatal).toMatch(/repeats its headings on every line/);
    expect(r.rejected).toEqual([]);
  });
  it("does not fire on a normal file", () => {
    const r = validateImport("sales", `${SALES_HEAD}\nI1,1,2026-07-01,C1,P1,2,10\nI2,1,2026-07-02,C1,P1,2,10\nI3,1,2026-07-03,C1,P1,2,10\n`, { today });
    expect(r.fatal).toBeNull();
    expect(r.accepted).toHaveLength(3);
  });
});
