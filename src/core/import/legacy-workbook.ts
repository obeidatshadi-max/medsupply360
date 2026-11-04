/**
 * Reads the spreadsheet formats `read-excel-file` cannot: the old binary `.xls`, and the files ERP systems save as
 * `.xls` that are really an HTML table or SpreadsheetML XML. SheetJS recognises all of these from the bytes, so the
 * file name does not matter. The result is the same grid per sheet that `readWorkbook` already understands.
 */
import * as XLSX from "xlsx";
import type { Cell, SheetGrid } from "./workbook";

/** A date-only cell as a UTC midnight date: `cellText` writes UTC days, and SheetJS builds dates in local time. */
function calendarDay(d: Date): Date {
  // A few minutes of slack absorb the second-level offsets old Excel dates carry in some time zones.
  const t = new Date(d.getTime() + 5 * 60_000);
  return new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()));
}

export function readLegacyWorkbook(bytes: ArrayBuffer | Uint8Array): SheetGrid[] {
  const wb = XLSX.read(bytes, { type: "array", cellDates: true });
  return wb.SheetNames.map((sheet) => {
    const ws = wb.Sheets[sheet]!;
    const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: null, blankrows: true });
    return { sheet, data: rows.map((r) => r.map((c) => (c instanceof Date ? calendarDay(c) : c))) };
  });
}
