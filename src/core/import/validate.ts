/**
 * Turns the text of an ERP export into clean rows plus a list of rejected rows with the reason, ready for the
 * accountant to fix and re-upload. Pure: no database, no clock (`today` is passed in).
 *
 * A bad row never blocks the good ones, and nothing is guessed. A file that cannot be read at all (missing required
 * column, no snapshot date, unclosed quote) comes back with `fatal` set and no rows.
 */
import { isIsoDate } from "../calc";
import { CsvError, parseCsv, type Delimiter } from "./csv";
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
    const field = wanted.get(norm(h));
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

  const dataRows = records.slice(1).flatMap((cells, i) => (cells.every((c) => c.trim() === "") ? [] : [{ row: i + 2, cells }]));
  if (dataRows.length > maxRows) return empty(kind, `The file has ${dataRows.length} rows; the limit is ${maxRows}. Split it by month.`, delimiter);

  const rejected: Issue[] = [];
  const warnings: Issue[] = [];
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
      return empty(kind, "This file is a point-in-time snapshot but has no snapshot date. Add a Snapshot Date column or enter the date when uploading.", delimiter);
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
