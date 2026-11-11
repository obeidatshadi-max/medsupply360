/**
 * Reads the spreadsheet formats `read-excel-file` cannot: the old binary `.xls`, and the files ERP systems save as
 * `.xls` that are really an HTML table or SpreadsheetML XML. SheetJS recognises all of these from the bytes, so the
 * file name does not matter. The result is the same grid per sheet that `readWorkbook` already understands.
 */
import * as XLSX from "xlsx";
import { decodeBytes } from "./encoding";
import type { Cell, SheetGrid } from "./workbook";

/** A date-only cell as a UTC midnight date: `cellText` writes UTC days, and SheetJS builds dates in local time. */
function calendarDay(d: Date): Date {
  // A few minutes of slack absorb the second-level offsets old Excel dates carry in some time zones.
  const t = new Date(d.getTime() + 5 * 60_000);
  return new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()));
}

/**
 * The page text when the bytes are an HTML table rather than a real workbook, else null. SpreadsheetML (`<?xml`)
 * is left to SheetJS: its cells are typed, so nothing has to be guessed.
 */
function htmlTableText(bytes: Uint8Array): string | null {
  let i = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x09 || bytes[i] === 0x0a || bytes[i] === 0x0d)) i++;
  const utf16 = (bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff);
  if (!utf16 && bytes[i] !== 0x3c) return null;
  // Arabic Windows exports are often Windows-1256: SheetJS would read them as UTF-8 and garble every name.
  const text = decodeBytes(bytes).text;
  const start = text.trimStart().slice(0, 200).toLowerCase();
  if (!start.startsWith("<") || start.startsWith("<?xml") || start.startsWith("<workbook")) return null;
  return /<table[\s>]/i.test(text) ? text : null;
}

export function readLegacyWorkbook(input: ArrayBuffer | Uint8Array): SheetGrid[] {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const html = htmlTableText(bytes);
  // An HTML table has only text. `raw` keeps it as written: left to guess, SheetJS reads 05/11/2026 month-first
  // (and a day early), while the importer reads day-first and refuses a month-first file.
  const wb = html === null ? XLSX.read(bytes, { type: "array", cellDates: true }) : XLSX.read(html, { type: "string", raw: true });
  return wb.SheetNames.map((sheet) => {
    const ws = wb.Sheets[sheet]!;
    const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: null, blankrows: true });
    return { sheet, data: rows.map((r) => r.map((c) => (c instanceof Date ? calendarDay(c) : c))) };
  });
}
