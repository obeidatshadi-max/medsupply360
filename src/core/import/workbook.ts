/**
 * Smart reading of a spreadsheet. Pure: the browser reads the .xlsx and hands over each sheet as a grid of cells; this
 * finds the header row of every sheet, says which file type the sheet is, and turns it into the same CSV text the
 * importer already validates. A workbook with several tabs therefore becomes several files, each checked on its own.
 *
 * Nothing here decides what is saved. The person sees what was understood (sheet, type, rows) and confirms it.
 */
import { detectKind } from "./detect";
import { SPECS, type ImportKind } from "./specs";

export type Cell = string | number | boolean | Date | null | undefined;
export type SheetGrid = { sheet: string; data: Cell[][] };

export type SheetRead = {
  sheet: string;
  /** The type recognised from the header row, or null when none fits clearly. */
  kind: ImportKind | null;
  /** Types that fit equally well when the header is ambiguous. */
  candidates: ImportKind[];
  /** 1-based spreadsheet row the headings were found on. */
  headerRow: number;
  /** Data rows after the header row, empty rows left out. */
  rows: number;
  /** CSV text starting at the header row. */
  csv: string;
  /** Why the sheet is not offered for import: instructions, examples, or nothing in it. */
  skipped: string | null;
};

/** Tabs that explain or demonstrate; the template says "do NOT upload this tab". */
const GUIDE_TAB = /^(read\s*me|readme|examples?|instructions?|notes?|help|اقرأني|أمثلة|تعليمات)\b/i;
/** How far down to look for the heading row: exports often start with a title and a date range. */
const HEADER_SEARCH_ROWS = 10;

const pad = (n: number) => String(n).padStart(2, "0");

/** One cell as CSV text. Dates become YYYY-MM-DD, yes/no cells become Yes / No, numbers are written plainly. */
export function cellText(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) {
    return Number.isNaN(cell.getTime()) ? "" : `${cell.getUTCFullYear()}-${pad(cell.getUTCMonth() + 1)}-${pad(cell.getUTCDate())}`;
  }
  if (typeof cell === "boolean") return cell ? "Yes" : "No";
  if (typeof cell === "number") return Number.isFinite(cell) ? String(cell) : "";
  return cell.replace(/ /g, " ").trim();
}

const quote = (text: string) => (/[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);
const line = (row: Cell[]) => row.map((c) => quote(cellText(c))).join(",");
const isBlank = (row: Cell[]) => row.every((c) => cellText(c) === "");

export function readSheetGrid({ sheet, data }: SheetGrid, allowed?: readonly ImportKind[]): SheetRead {
  const base = { sheet, kind: null, candidates: [], headerRow: 1, rows: 0, csv: "" } satisfies Omit<SheetRead, "skipped">;
  if (GUIDE_TAB.test(sheet.trim())) return { ...base, skipped: "This tab explains or shows examples; it is not data." };
  const filled = data.filter((r) => !isBlank(r));
  if (filled.length === 0) return { ...base, skipped: "The tab is empty." };

  // The first row within the search window whose headings fit one type clearly is the header row.
  let found: { index: number; kind: ImportKind } | null = null;
  let firstGuess: { index: number; candidates: ImportKind[] } | null = null;
  for (let i = 0; i < Math.min(data.length, HEADER_SEARCH_ROWS); i++) {
    const row = data[i]!;
    if (isBlank(row)) continue;
    const d = detectKind(line(row));
    if (d.kind !== null && (allowed === undefined || allowed.includes(d.kind))) {
      found = { index: i, kind: d.kind };
      break;
    }
    if (d.kind !== null) firstGuess ??= { index: i, candidates: [d.kind] };
    else if (d.candidates.length > 0) firstGuess ??= { index: i, candidates: d.candidates };
  }
  const index = found?.index ?? firstGuess?.index ?? data.findIndex((r) => !isBlank(r));
  const body = data.slice(index).filter((r) => !isBlank(r));
  const kind = found?.kind ?? null;
  return {
    sheet,
    kind,
    candidates: kind ? [] : (firstGuess?.candidates ?? []),
    headerRow: index + 1,
    rows: Math.max(0, body.length - 1),
    csv: body.map(line).join("\n"),
    skipped: body.length < 2 ? "Only a heading row, no data rows." : null,
  };
}

export function readWorkbook(sheets: SheetGrid[], allowed?: readonly ImportKind[]): SheetRead[] {
  return sheets.map((s) => readSheetGrid(s, allowed));
}

/** Plain name of the type for messages. */
export const kindTitle = (kind: ImportKind) => SPECS[kind].title;
