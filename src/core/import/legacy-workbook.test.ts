import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { readLegacyWorkbook } from "./legacy-workbook";
import { validateImport } from "./validate";
import { readWorkbook } from "./workbook";

const header = ["Customer code", "Customer name", "City"];

function bytesOf(bookType: XLSX.BookType, rows: unknown[][]): Uint8Array {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Customers");
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType }));
}

describe("readLegacyWorkbook", () => {
  it("reads a binary .xls and the importer recognises the sheet", () => {
    const grids = readLegacyWorkbook(bytesOf("biff8", [["Alpha ERP"], [], header, ["C-1", "صيدلية الشفاء", "Baghdad"]]));
    expect(grids[0]!.sheet).toBe("Customers");
    const [read] = readWorkbook(grids);
    expect(read!.kind).toBe("customers");
    expect(read!.headerRow).toBe(3);
    expect(read!.csv).toContain("صيدلية الشفاء");
  });

  it("reads an .xls that is really an HTML table", () => {
    const html = `<html><body><table><tr>${header.map((h) => `<th>${h}</th>`).join("")}</tr><tr><td>C-9</td><td>Al Noor</td><td>Basra</td></tr></table></body></html>`;
    const [read] = readWorkbook(readLegacyWorkbook(new TextEncoder().encode(html)));
    expect(read!.kind).toBe("customers");
    expect(read!.rows).toBe(1);
  });

  // What "Export to Excel" in many ERPs really saves: an HTML table named .xls, with dates as day-first text.
  const SALES = ["Invoice No", "Line No", "Invoice Date", "Customer Code", "Product Code", "Quantity", "Net Sales"];
  const htmlTable = (head: string[], rows: string[][], meta = "") =>
    `<html><head>${meta}</head><body><table><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</table></body></html>`;

  it("keeps day-first dates and amounts of an HTML table as written", () => {
    const html = htmlTable(SALES, [
      ["I1", "1", "05/11/2026", "C1", "P1", "2", "1,234.500"],
      ["I2", "1", "28/10/2026", "C1", "P1", "10", "12,500.000"],
      ["I3", "1", "04/03/2026", "C1", "P1", "1", "99.75"],
    ]);
    const [read] = readWorkbook(readLegacyWorkbook(new TextEncoder().encode(html)));
    expect(read!.kind).toBe("sales");
    const r = validateImport("sales", read!.csv, { today: "2026-11-11" });
    expect(r.rejected).toEqual([]);
    expect(r.accepted.map((a) => a.values.invoiceDate)).toEqual(["2026-11-05", "2026-10-28", "2026-03-04"]);
    expect(r.accepted.map((a) => Number(a.values.netSales))).toEqual([1234.5, 12500, 99.75]);
  });

  it("reads Arabic headings of an HTML table saved in Windows-1256", () => {
    const html = htmlTable(["Customer code", "اسم العميل", "City"], [["C-9", "صيدلية الشفاء", "Amman"]], '<meta http-equiv="Content-Type" content="text/html; charset=windows-1256">');
    // Windows-1256 bytes: every character of the page is ASCII or in the upper half of the code page.
    const upper = new Map<string, number>();
    for (let b = 0x80; b <= 0xff; b++) upper.set(new TextDecoder("windows-1256").decode(new Uint8Array([b])), b);
    const bytes = new Uint8Array([...html].map((ch) => (ch.charCodeAt(0) < 0x80 ? ch.charCodeAt(0) : upper.get(ch)!)));
    const [read] = readWorkbook(readLegacyWorkbook(bytes));
    expect(read!.csv).toContain("اسم العميل");
    expect(read!.csv).toContain("صيدلية الشفاء");
    expect(read!.kind).toBe("customers");
  });

  it("keeps a date cell on its calendar day", () => {
    const grids = readLegacyWorkbook(bytesOf("biff8", [["Date"], [new Date(Date.UTC(2026, 2, 5))]]));
    const cell = grids[0]!.data[1]![0];
    expect(cell).toBeInstanceOf(Date);
    expect((cell as Date).toISOString().slice(0, 10)).toBe("2026-03-05");
  });
});
