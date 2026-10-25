/**
 * Column mapping for a file whose headings the importer does not know. Pure: the browser shows the unmatched
 * columns, the person pairs them with importer fields, and `applyMapping` renames those headings in the first line
 * of the CSV so the unchanged importer reads the file. Nothing is guessed: a suggestion is only a hint.
 */
import { detectDelimiter, parseCsv, type Delimiter } from "./csv";
import { SPECS, type FieldSpec, type ImportKind } from "./specs";
import { mapColumns, norm } from "./validate";

/** Importer field key -> heading in the file that holds it. */
export type Mapping = Record<string, string>;

/** What the person chose before, per file type: normalised source heading -> importer field key. */
export type Remembered = Partial<Record<ImportKind, Record<string, string>>>;

export interface ColumnReport {
  /** Required fields no column matches. The file cannot be loaded until each has a column. */
  missingRequired: FieldSpec[];
  /** Optional fields no column matches. */
  missingOptional: FieldSpec[];
  /** Headings no field uses, in file order. These are the choices offered. */
  unused: string[];
  /** Two columns claim one field; renaming cannot help, the file needs one of them removed. */
  ambiguous: boolean;
}

export const fieldLabel = (f: FieldSpec) => f.aliases[0] ?? f.key;

export function columnReport(kind: ImportKind, header: string[]): ColumnReport {
  const spec = SPECS[kind];
  const { columnOf, ignored, ambiguous } = mapColumns(spec, header);
  return {
    missingRequired: spec.fields.filter((f) => f.required && !columnOf.has(f.key)),
    missingOptional: spec.fields.filter((f) => !f.required && !columnOf.has(f.key)),
    unused: ignored,
    ambiguous: ambiguous.length > 0,
  };
}

const words = (s: string) =>
  s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9؀-ۿ]+/)
    .filter((w) => w.length > 1);

/** A heading that looks like the field, or null. A hint for the person, never applied by itself. */
export function suggestColumn(field: FieldSpec, unused: string[]): string | null {
  const names = [field.key, ...field.aliases];
  let best: { heading: string; score: number } | null = null;
  for (const heading of unused) {
    const h = norm(heading);
    if (h === "") continue;
    let score = 0;
    for (const name of names) {
      const n = norm(name);
      if (n.length >= 3 && (h.includes(n) || n.includes(h)) && h.length >= 3) score = Math.max(score, 2);
      else if (words(heading).some((w) => words(name).includes(w))) score = Math.max(score, 1);
    }
    if (score > 0 && (best === null || score > best.score)) best = { heading, score };
  }
  return best?.heading ?? null;
}

const quote = (text: string, d: Delimiter) => (text.includes(d) || /["\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);

/** The first line of a CSV and the rest of the text after its line break (empty when the file is one line). */
function splitHeader(csv: string): { head: string; tail: string } {
  const text = csv.replace(/^﻿/, "");
  const m = /\r\n|\n|\r/.exec(text);
  return m ? { head: text.slice(0, m.index), tail: text.slice(m.index) } : { head: text, tail: "" };
}

export function headerOf(csv: string): string[] {
  const { head } = splitHeader(csv);
  try {
    return parseCsv(head, detectDelimiter(head)).records[0] ?? [];
  } catch {
    return [];
  }
}

/**
 * Renames the mapped headings to the importer's own field names. A pair is skipped, not forced, when the heading is
 * not in the file, already means another field, or the field already has a column: the check then reports what is
 * wrong instead of the data being read from the wrong column.
 */
export function applyMapping(kind: ImportKind, csv: string, mapping: Mapping): string {
  const spec = SPECS[kind];
  const { head, tail } = splitHeader(csv);
  const delimiter = detectDelimiter(head);
  let header: string[];
  try {
    header = parseCsv(head, delimiter).records[0] ?? [];
  } catch {
    return csv;
  }
  const next = [...header];
  const { columnOf } = mapColumns(spec, header);
  const taken = new Set(columnOf.keys());
  const known = new Set(columnOf.values());
  for (const [fieldKey, source] of Object.entries(mapping)) {
    if (!spec.fields.some((f) => f.key === fieldKey) || taken.has(fieldKey)) continue;
    const index = header.findIndex((h, i) => !known.has(i) && h.trim() === source.trim());
    if (index < 0) continue;
    next[index] = fieldKey;
    taken.add(fieldKey);
    known.add(index);
  }
  return next.map((c) => quote(c, delimiter)).join(delimiter) + tail;
}

/** Remembered choices that fit this file: a saved heading that appears among the unused headings. */
export function rememberedMapping(kind: ImportKind, unused: string[], remembered: Remembered): Mapping {
  const saved = remembered[kind] ?? {};
  const out: Mapping = {};
  for (const heading of unused) {
    const fieldKey = saved[norm(heading)];
    if (fieldKey && SPECS[kind].fields.some((f) => f.key === fieldKey) && !(fieldKey in out)) out[fieldKey] = heading;
  }
  return out;
}

/** Records one choice (or forgets it when `heading` is empty). Returns a new object. */
export function remember(remembered: Remembered, kind: ImportKind, fieldKey: string, heading: string, previous?: string): Remembered {
  const forKind = { ...(remembered[kind] ?? {}) };
  if (previous) delete forKind[norm(previous)];
  if (heading.trim() !== "") forKind[norm(heading)] = fieldKey;
  return { ...remembered, [kind]: forKind };
}
