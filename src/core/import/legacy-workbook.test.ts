import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { readLegacyWorkbook } from "./legacy-workbook";
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

  it("keeps a date cell on its calendar day", () => {
    const grids = readLegacyWorkbook(bytesOf("biff8", [["Date"], [new Date(Date.UTC(2026, 2, 5))]]));
    const cell = grids[0]!.data[1]![0];
    expect(cell).toBeInstanceOf(Date);
    expect((cell as Date).toISOString().slice(0, 10)).toBe("2026-03-05");
  });
});
