/**
 * Field parsers for ERP exports. Each takes a non-empty trimmed string and either returns a clean value or a
 * reason it was refused. Nothing is guessed: an unreadable number or date rejects the row, and an unrecognised
 * label is refused (or, where the field is optional, kept as unknown with a warning), never defaulted.
 */
import { isIsoDate } from "../calc";

export type Value = string | number | boolean | null;
export type Parsed = { ok: true; value: Value; warning?: string } | { ok: false; reason: string };
export type Parser = (raw: string) => Parsed;

const ok = (value: Value, warning?: string): Parsed => ({ ok: true, value, warning });
const fail = (reason: string): Parsed => ({ ok: false, reason });

/** Arabic-Indic and Persian digits and Arabic separators, so a file typed on an Arabic keyboard still reads. */
export function normalizeDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".")
    .replace(/٬/g, ",");
}

const compact = (s: string) => s.normalize("NFKC").replace(/\s+/g, " ").trim();

export const text =
  (max: number): Parser =>
  (raw) => {
    const v = compact(raw);
    return v.length > max ? fail(`longer than ${max} characters`) : ok(v);
  };

/** Business keys (codes, invoice numbers): case and inner spaces are kept exactly, as the ERP wrote them. */
export const code =
  (max: number): Parser =>
  (raw) => {
    const v = raw.trim();
    return v.length > max ? fail(`longer than ${max} characters`) : ok(v);
  };

/**
 * Reads YYYY-MM-DD, YYYY/MM/DD, and day-first D/M/YYYY, D-M-YYYY, D.M.YYYY (the Jordan / Iraq convention; a
 * month-first file would be misread, so the sample file must confirm the order). A trailing time is ignored.
 */
export const date: Parser = (raw) => {
  const s = normalizeDigits(raw).trim();
  let y: string, m: string, d: string;
  let match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T].*)?$/.exec(s);
  if (match) [, y, m, d] = match;
  else if ((match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[ T].*)?$/.exec(s))) [, d, m, y] = match;
  else return fail(`not a date: "${raw}"`);
  const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  return isIsoDate(iso) ? ok(iso) : fail(`not a real calendar date: "${raw}"`);
};

/** Plain decimal text. Accepts 1234.5, 1,234.500, (12.5) and -12.5; refuses anything ambiguous such as 1234,5. */
function readDecimal(raw: string): { negative: boolean; digits: string } | null {
  let s = normalizeDigits(raw).replace(/\s/g, "");
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.endsWith("-")) {
    negative = !negative;
    s = s.slice(0, -1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  if (/^\d+(\.\d+)?$/.test(s)) return { negative, digits: s };
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return { negative, digits: s.replace(/,/g, "") };
  return null;
}

/** JOD amount rounded to fils, as text so no float ever reaches the database. numeric(14,3) holds 11 integer digits. */
export const money: Parser = (raw) => {
  const n = readDecimal(raw);
  if (!n) return fail(`not a number: "${raw}"`);
  const value = Number(n.digits);
  if (!Number.isFinite(value) || value >= 1e11) return fail(`number is too large: "${raw}"`);
  const fixed = value.toFixed(3);
  return ok(n.negative && Number(fixed) !== 0 ? `-${fixed}` : fixed);
};

/** Quantity: same format as money, signed (returns are negative). */
export const quantity: Parser = money;

export const positiveDecimal: Parser = (raw) => {
  const r = money(raw);
  return r.ok && !(Number(r.value) > 0) ? fail(`must be greater than zero: "${raw}"`) : r;
};

export const nonNegativeMoney: Parser = (raw) => {
  const r = money(raw);
  return r.ok && Number(r.value) < 0 ? fail(`must not be negative: "${raw}"`) : r;
};

/** Whole number of days, e.g. "90" or "Net 90". */
export const days: Parser = (raw) => {
  const m = /^\D*(\d{1,4})\D*$/.exec(normalizeDigits(raw).trim());
  return m ? ok(Number(m[1])) : fail(`not a number of days: "${raw}"`);
};

const YES = new Set(["yes", "y", "true", "1", "نعم", "ن"]);
const NO = new Set(["no", "n", "false", "0", "لا"]);
export const bool: Parser = (raw) => {
  const s = compact(raw).toLowerCase();
  if (YES.has(s)) return ok(true);
  if (NO.has(s)) return ok(false);
  return fail(`expected Yes or No, got "${raw}"`);
};

const label = (s: string) => compact(s).toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, " ").trim();

/**
 * Maps the ERP's wording to one of our values. `onUnknown: "reject"` refuses the row; `"null"` keeps the row with
 * the field unknown and a warning, for optional classifications where a wrong guess would be worse than a gap.
 */
export function oneOf<T extends string>(
  name: string,
  map: Record<T, string[]>,
  onUnknown: "reject" | "null",
): Parser {
  const lookup = new Map<string, T>();
  for (const [value, words] of Object.entries(map) as [T, string[]][]) {
    lookup.set(label(value), value);
    for (const w of words) lookup.set(label(w), value);
  }
  return (raw) => {
    const hit = lookup.get(label(raw));
    if (hit) return ok(hit);
    return onUnknown === "reject" ? fail(`unrecognised ${name}: "${raw}"`) : ok(null, `unrecognised ${name} "${raw}", left unknown`);
  };
}

/** Whole number from 0 up to `max`, e.g. visits per week. */
export const wholeNumber =
  (max: number): Parser =>
  (raw) => {
    const s = normalizeDigits(raw).trim();
    if (!/^\d+$/.test(s)) return fail(`not a whole number: "${raw}"`);
    return Number(s) > max ? fail(`must be ${max} or less: "${raw}"`) : ok(Number(s));
  };

/** A list written in one cell, separated by ; | or new lines (Arabic comma too). Kept as one text joined by ";", duplicates dropped. */
export const semicolonList =
  (maxItems: number, maxLength: number): Parser =>
  (raw) => {
    const seen = new Set<string>();
    const items: string[] = [];
    for (const part of raw.split(/[;|\n\r؛،]+/)) {
      const v = compact(part);
      if (v === "" || seen.has(v.toLowerCase())) continue;
      if (v.length > maxLength) return fail(`an item is longer than ${maxLength} characters`);
      seen.add(v.toLowerCase());
      items.push(v);
    }
    return items.length > maxItems ? fail(`more than ${maxItems} items`) : ok(items.join(";"));
  };
