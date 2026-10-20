/**
 * Works out which ERP export a CSV is from its header row alone, so several files can be dropped in at once.
 * Pure. A guess is only made when one type clearly fits better than the rest; otherwise the person chooses.
 */
import { detectDelimiter, parseCsv } from "./csv";
import { SPECS, type ImportKind } from "./specs";
import { mapColumns } from "./validate";

/** Master data first: sales, receipts and stock rows point at product and customer codes that must already exist. */
export const IMPORT_ORDER: ImportKind[] = ["products", "customers", "sales", "receipts", "open_invoices", "stock_snapshot", "stock_transactions", "installed_units", "sales_people", "tenders"];

export type Detection =
  | { kind: ImportKind; certain: true }
  /** Several types fit equally well, or none does. `candidates` lists the ones that fit. */
  | { kind: null; certain: false; candidates: ImportKind[] };

/** The first line only: a header never spans lines, and a cut-off sample must not trip the quote check. */
const firstLine = (text: string) => text.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "";

export function detectKind(text: string): Detection {
  const line = firstLine(text);
  let header: string[];
  try {
    header = parseCsv(line, detectDelimiter(line)).records[0] ?? [];
  } catch {
    return { kind: null, certain: false, candidates: [] };
  }
  const fits = IMPORT_ORDER.flatMap((kind) => {
    const spec = SPECS[kind];
    const { columnOf, ambiguous } = mapColumns(spec, header);
    if (ambiguous.length > 0 || spec.fields.some((f) => f.required && !columnOf.has(f.key))) return [];
    return [{ kind, matched: columnOf.size, required: spec.fields.filter((f) => f.required).length }];
  });
  if (fits.length === 0) return { kind: null, certain: false, candidates: [] };
  // More recognised columns wins; on a tie the type with more required fields is the more specific one.
  const rank = (f: (typeof fits)[number]) => f.matched * 100 + f.required;
  const best = Math.max(...fits.map(rank));
  const top = fits.filter((f) => rank(f) === best);
  return top.length === 1 ? { kind: top[0]!.kind, certain: true } : { kind: null, certain: false, candidates: top.map((f) => f.kind) };
}
