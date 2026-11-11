/**
 * Turns the text of an ERP export into clean rows plus a list of rejected rows with the reason, ready for the
 * accountant to fix and re-upload. Pure: no database, no clock (`today` is passed in).
 *
 * A bad row never blocks the good ones, and nothing is guessed. A file that cannot be read at all (missing required
 * column, no snapshot date, unclosed quote) comes back with `fatal` set and no rows.
 */
import { isIsoDate } from "../calc";
import { CsvError, parseCsv, type Delimiter } from "./csv";
import { date, normalizeDigits } from "./parsers";
import { SPECS, type FieldSpec, type FileSpec, type ImportKind, type RowRef, type Values } from "./specs";

export interface Issue {
  row: number;
  reason: string;
}

export interface ValidateOptions {
  /** Import day, YYYY-MM-DD. Dates after it are rejected. */
  today: string;
  /** For point-in-time files without a snapshot date column. */
  snapshotDate?: string;
  maxRows?: number;
}

export interface ValidationResult {
  kind: ImportKind;
  delimiter: Delimiter | null;
  /** Data rows that are not blank. Accepted + rejected = rowsTotal. */
  rowsTotal: number;
  accepted: RowRef[];
  rejected: Issue[];
  /** Accepted rows that carry a gap worth knowing about, e.g. an unrecognised segment kept as unknown. */
  warnings: Issue[];
  /** Columns in the file that the importer does not read. */
  ignoredColumns: string[];
  mappedColumns: { field: string; sourceColumn: string }[];
  snapshotDate: string | null;
  /** Set when the whole file is unusable. */
  fatal: string | null;
}

export const DEFAULT_MAX_ROWS = 50_000;

/** Case, spaces and punctuation do not matter: "Invoice No.", "invoice_no" and "INVOICE NO" are the same header. */
export const norm = (s: string) =>
  s
    .replace(/^﻿/, "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, "");

/**
 * Fills the blank document details of a grouped report from the line above. Pure apart from writing into `rows`.
 * Only a file that looks grouped is touched: a line counts as a continuation when every `fillDown` column in the file is
 * blank and the line has other values, and the first line must be filled. A line with only some details blank is left
 * as it is, so it is still rejected for the blank required cell.
 */
export function fillGroupedLines(spec: FileSpec, columnOf: Map<string, number>, rows: { row: number; cells: string[] }[]) {
  const cols = (spec.fillDown ?? []).flatMap((key) => {
    const col = columnOf.get(key);
    return col === undefined ? [] : [{ key, col }];
  });
  const none = { lines: 0, firstRow: 0, labels: [] as string[] };
  if (cols.length === 0 || rows.length < 2) return none;
  const others = [...columnOf.values()].filter((col) => !cols.some((c) => c.col === col));
  const blank = (cells: string[], col: number) => (cells[col] ?? "").trim() === "";
  const isContinuation = (cells: string[]) => cols.every((c) => blank(cells, c.col)) && others.some((col) => !blank(cells, col));
  if (isContinuation(rows[0]!.cells) || !rows.some((r) => isContinuation(r.cells))) return none;
  let above = rows[0]!.cells;
  let lines = 0;
  let firstRow = 0;
  for (const r of rows) {
    if (!isContinuation(r.cells)) {
      above = r.cells;
      continue;
    }
    const cells = [...r.cells];
    for (const c of cols) cells[c.col] = above[c.col] ?? "";
    r.cells = cells;
    lines++;
    if (firstRow === 0) firstRow = r.row;
  }
  const labels = cols.filter((c) => rows.some((r) => !blank(r.cells, c.col))).map((c) => spec.fields.find((f) => f.key === c.key)?.aliases[0] ?? c.key);
  return { lines, firstRow, labels };
}

const TOTAL_LABEL = /^(grand\s+|sub[\s-]*)?totals?(?![\p{L}\p{N}_])|^(المجموع|الإجمالي|الاجمالي|مجموع|إجمالي)/iu;
const NUMBER_ONLY = /^[\s\d.,()+\-٠-٩۰-۹٫٬%]*$/;
/** A line whose first filled cell says "Total" and whose other filled cells are only numbers. */
function isTotalRow(cells: string[]): boolean {
  const filled = cells.map((c) => c.trim()).filter((c) => c !== "");
  return filled.length > 0 && TOTAL_LABEL.test(filled[0]!) && filled.slice(1).every((c) => NUMBER_ONLY.test(c));
}

const empty = (kind: ImportKind, fatal: string, delimiter: Delimiter | null = null): ValidationResult => ({
  kind,
  delimiter,
  rowsTotal: 0,
  accepted: [],
  rejected: [],
  warnings: [],
  ignoredColumns: [],
  mappedColumns: [],
  snapshotDate: null,
  fatal,
});

/** Refuse ambiguous mappings rather than silently choosing the first matching source column. */
export function mapColumns(spec: FileSpec, header: string[]) {
  const wanted = new Map<string, FieldSpec>();
  for (const field of spec.fields) {
    wanted.set(norm(field.key), field);
    for (const a of field.aliases) if (!wanted.has(norm(a))) wanted.set(norm(a), field);
  }
  const columnOf = new Map<string, number>();
  const ignored: string[] = [];
  const ambiguous: string[] = [];
  header.forEach((h, i) => {
    // A unit or note in brackets ("Net Amount (JOD)") is not part of the name.
    const field = wanted.get(norm(h)) ?? wanted.get(norm(h.replace(/\([^)]*\)|\[[^\]]*\]/g, "")));
    if (field && columnOf.has(field.key)) {
      ambiguous.push(`${field.key}: "${header[columnOf.get(field.key)!]}" (column ${columnOf.get(field.key)! + 1}) and "${h}" (column ${i + 1})`);
    }
    else if (field) columnOf.set(field.key, i);
    else if (h.trim() !== "") ignored.push(h.trim());
  });
  return { columnOf, ignored, ambiguous };
}

export function validateImport(kind: ImportKind, text: string, options: ValidateOptions): ValidationResult {
  const spec = SPECS[kind];
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  if (!isIsoDate(options.today)) throw new RangeError(`today is not a valid YYYY-MM-DD date: "${options.today}"`);
  if (options.snapshotDate !== undefined && !isIsoDate(options.snapshotDate)) {
    return empty(kind, `The snapshot date "${options.snapshotDate}" is not a valid date.`);
  }

  let parsed: ReturnType<typeof parseCsv>;
  try {
    parsed = parseCsv(text);
  } catch (e) {
    if (e instanceof CsvError) return empty(kind, e.message);
    throw e;
  }
  const { delimiter, records } = parsed;
  if (records.length === 0 || records[0].every((c) => c.trim() === "")) return empty(kind, "The file is empty or has no header row.", delimiter);

  const { columnOf, ignored, ambiguous } = mapColumns(spec, records[0]);
  if (ambiguous.length > 0) return empty(kind, `Ambiguous columns: ${ambiguous.join("; ")}. Keep one source column per field, then check the file again.`, delimiter);
  const mappedColumns = [...columnOf].map(([field, col]) => ({ field, sourceColumn: records[0][col] }));
  const missing = spec.fields.filter((fld) => fld.required && !columnOf.has(fld.key));
  if (missing.length > 0) {
    const names = missing.map((fld) => `${fld.aliases[0] ?? fld.key} (also accepted: ${fld.aliases.slice(1, 3).join(", ") || fld.key})`);
    return empty(kind, `Required column${missing.length > 1 ? "s" : ""} not found: ${names.join("; ")}. Found: ${records[0].map((h) => h.trim()).filter(Boolean).join(", ")}.`, delimiter);
  }

  // A report's closing "Total" line is not data: leave it out with a note, so it cannot sink a whole snapshot.
  const totalLines: Issue[] = [];
  const dataRows = records.slice(1).flatMap((cells, i) => {
    if (cells.every((c) => c.trim() === "")) return [];
    if (isTotalRow(cells)) {
      totalLines.push({ row: i + 2, reason: "looks like a totals line of the report, so it was left out" });
      return [];
    }
    return [{ row: i + 2, cells }];
  });

  // A grouped report prints the invoice (or receipt) details once and leaves them blank on the lines that follow.
  const filled = fillGroupedLines(spec, columnOf, dataRows);

  // Some report tools write the labels into every record beside the values, so the column under a heading holds
  // the heading again on every line. One message for the file is clearer than "not a date" on every row.
  const repeated = [...columnOf.values()].filter((col) => {
    const heading = records[0][col]!.trim();
    return heading !== "" && dataRows.every(({ cells }) => (cells[col] ?? "").trim() === heading);
  });
  if (dataRows.length >= 2 && repeated.length >= 2) {
    return empty(kind, "This file repeats its headings on every line (a printed report layout, not a table), so the columns hold labels instead of values. Export the report to Excel (.xls or .xlsx) and upload that instead.", delimiter);
  }

  // Day-first is assumed. A day above 12 in the second place and none in the first means the whole file is month-first:
  // reading it day-first would silently swap day and month on every row where both are 12 or less.
  let dayFirst = false;
  let monthFirst = false;
  for (const fld of spec.fields) {
    const col = fld.parse === date ? columnOf.get(fld.key) : undefined;
    if (col === undefined) continue;
    for (const { cells } of dataRows) {
      const m = /^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/.exec(normalizeDigits((cells[col] ?? "").trim()));
      if (!m) continue;
      if (Number(m[1]) > 12) dayFirst = true;
      if (Number(m[2]) > 12) monthFirst = true;
    }
  }
  if (monthFirst && !dayFirst) {
    return empty(kind, "The dates look month-first (for example 05/13/2026). The app reads day first, so it would swap day and month. Export again with dates as DD/MM/YYYY or YYYY-MM-DD.", delimiter);
  }
  if (dataRows.length > maxRows) return empty(kind, `The file has ${dataRows.length} rows; the limit is ${maxRows}. Split it by month.`, delimiter);

  const rejected: Issue[] = [];
  const warnings: Issue[] = [...totalLines];
  if (filled.lines > 0) {
    warnings.push({
      row: filled.firstRow,
      reason: `grouped report: on ${filled.lines} line${filled.lines > 1 ? "s" : ""} the ${filled.labels.join(", ")} ${filled.labels.length > 1 ? "were" : "was"} blank and copied from the line above. Check that each line belongs to the document above it`,
    });
  }
  const reject = (row: number, reason: string) => rejected.push({ row, reason });

  // Pass 1: read every cell.
  const candidates: RowRef[] = [];
  for (const { row, cells } of dataRows) {
    if (cells.length > records[0].length && cells.slice(records[0].length).some((c) => c.trim() !== "")) {
      reject(row, "the row has more values than the header has columns (check for an unquoted comma)");
      continue;
    }
    const values: Values = {};
    const reasons: string[] = [];
    const rowWarnings: string[] = [];
    for (const field of spec.fields) {
      const col = columnOf.get(field.key);
      const raw = col === undefined ? "" : (cells[col] ?? "").trim();
      if (raw === "") {
        if (field.required) reasons.push(`${field.aliases[0] ?? field.key} is empty`);
        else values[field.key] = field.fallback ?? null;
        continue;
      }
      const r = field.parse(raw);
      if (!r.ok) reasons.push(`${field.aliases[0] ?? field.key}: ${r.reason}`);
      else {
        values[field.key] = r.value;
        if (r.warning) rowWarnings.push(`${field.aliases[0] ?? field.key}: ${r.warning}`);
      }
    }
    if (reasons.length > 0) {
      reject(row, reasons.join("; "));
      continue;
    }
    for (const w of rowWarnings) warnings.push({ row, reason: w });
    candidates.push({ row, values });
  }

  // Snapshot date: the upload form wins, else the column. Every row must agree with it.
  let fileDate: string | null = null;
  if (spec.snapshot) {
    fileDate = options.snapshotDate ?? candidates.map((c) => c.values.snapshotDate).find((d): d is string => typeof d === "string") ?? null;
    if (fileDate === null) {
      if (candidates.length === 0 && rejected.length > 0) return { ...empty(kind, "", delimiter), rowsTotal: dataRows.length, rejected, warnings, ignoredColumns: ignored, fatal: null };
      return empty(kind, "This file is a list as of one date, but it has no date. Add a Snapshot Date column, or enter the date when you upload.", delimiter);
    }
    if (fileDate > options.today) return empty(kind, `The snapshot date ${fileDate} is in the future.`, delimiter);
  }

  // Pass 2: rules inside a row, then duplicates.
  const seen = new Map<string, number>();
  const survivors: RowRef[] = [];
  for (const cand of candidates) {
    const { row, values } = cand;
    if (spec.snapshot) {
      const own = values.snapshotDate;
      if (typeof own === "string" && own !== fileDate) {
        reject(row, `snapshot date ${own} differs from the file's snapshot date ${fileDate}`);
        continue;
      }
      values.snapshotDate = fileDate;
    }
    const future = (spec.notFuture ?? []).find((key) => typeof values[key] === "string" && (values[key] as string) > options.today);
    if (future) {
      reject(row, `${future} ${values[future]} is after today (${options.today}): check day / month order`);
      continue;
    }
    spec.derive?.(values);
    const problem = spec.check?.(values);
    if (problem) {
      reject(row, problem);
      continue;
    }
    const key = spec.key(values);
    const first = seen.get(key);
    if (first !== undefined) {
      reject(row, `duplicate of row ${first} in this file`);
      continue;
    }
    seen.set(key, row);
    survivors.push(cand);
  }

  // Pass 3: rules across rows.
  const groupProblems = spec.checkGroups?.(survivors) ?? new Map<number, string>();
  const accepted = survivors.filter((r) => {
    const problem = groupProblems.get(r.row);
    if (problem) reject(r.row, problem);
    return !problem;
  });

  rejected.sort((a, b) => a.row - b.row);
  const rejectedRows = new Set(rejected.map((r) => r.row));
  return {
    kind,
    delimiter,
    rowsTotal: dataRows.length,
    accepted,
    rejected,
    warnings: warnings.filter((w) => !rejectedRows.has(w.row)).sort((a, b) => a.row - b.row),
    ignoredColumns: ignored,
    mappedColumns,
    snapshotDate: fileDate,
    fatal: null,
  };
}
