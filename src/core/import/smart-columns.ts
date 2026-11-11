/**
 * Smart column matching, for headings the importer does not know by name. Pure. Goes past the exact names and aliases
 * in `specs.ts`:
 *  1. headings that say the same thing differently: reordered words ("Date Invoice"), extra words ("Customer Code (ERP)"),
 *     camelCase, short forms ("cust", "qty", "amt"), one-letter typos, and Arabic written with or without "ال" / hamza;
 *  2. what a column holds, for the one kind of value that cannot be mistaken: dates.
 *
 * A guess is taken only when it is clear: the pair must be the best choice for both the heading and the field, with a
 * clear margin over the runner-up, and a match that rests only on a generic word ("date", "name", "code", "رقم") is
 * refused. Numbers are never matched by their values: two number columns cannot be told apart safely. Anything left
 * over stays open for the person. Every guess is shown and can be changed, and nothing is saved before Confirm.
 * Same method as Marsad's `smart-mapping.ts`, so the two apps match columns alike.
 */
import { parseCsv } from "./csv";
import { applyMapping, columnReport, headerOf, type Mapping } from "./column-map";
import { IMPORT_ORDER, ruledOut } from "./detect";
import { date } from "./parsers";
import { SPECS, type FieldSpec, type ImportKind } from "./specs";

/** Words that appear in many fields; sharing only these says nothing about which field a heading is. */
const GENERIC = new Set([
  "date", "name", "code", "no", "nr", "num", "number", "id", "type", "amount", "value", "total", "jod", "jd", "pct", "days", "of", "the",
  "رقم", "اسم", "تاريخ", "قيمه", "مبلغ", "كود", "رمز", "نوع", "عدد", "مجموع", "اجمالي",
]);

const ACCEPT = 0.7;
const MARGIN = 0.1;

/** Arabic letter forms that are typed either way: hamza on alef, taa marbuta, alef maqsura; tashkeel and tatweel dropped. */
function foldArabic(s: string): string {
  return s
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}

/** A word without the Arabic article, so "العميل" and "عميل" read the same. */
const bare = (w: string) => (/^ال[؀-ۿ]{2,}$/.test(w) ? w.slice(2) : w);

/**
 * Arabic words ERP reports use for the same thing, read as one word: code (رقم / رمز / كود), item (صنف / مادة / منتج),
 * customer (عميل / زبون), amount (قيمة / مبلغ). Compared after `foldArabic` and `bare`.
 */
const AR_SAME: Record<string, string> = { رمز: "رقم", كود: "رقم", ماده: "صنف", منتج: "صنف", زبون: "عميل", مبلغ: "قيمه" };
const canon = (w: string) => AR_SAME[w] ?? w;

/** Splits camelCase first, so "InvoiceDate", "invoice_date" and "Invoice Date" read the same. */
export function words(heading: string): string[] {
  return foldArabic(
    heading
      .replace(/^﻿/, "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .normalize("NFKC")
      .toLowerCase(),
  )
    .split(/[^a-z0-9؀-ۿ]+/)
    .filter(Boolean)
    .map(bare)
    .map(canon);
}

/** One edit away (insert, delete or swap/replace one letter). */
function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  return long.slice(i + 1) === short.slice(i);
}

/** Same word, allowing a short form ("cust" for "customer", "qty" for "quantity", "amt" for "amount") or a one-letter typo. */
export function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (/^\d+$/.test(short) || short.length < 2) return false;
  if (short.length >= 3 && long.startsWith(short)) return true;
  if (short.length <= 4 && short[0] === long[0] && short[short.length - 1] === long[long.length - 1]) {
    let at = 0;
    for (const ch of long) if (ch === short[at]) at++;
    if (at === short.length) return true;
  }
  return short.length >= 5 && withinOneEdit(short, long);
}

/** How well a heading's words fit one name a field is known by, 0 to 1. */
export function phraseScore(heading: string[], phrase: string[]): number {
  if (!heading.length || !phrase.length) return 0;
  // Read each heading word as the name word it stands for, when it stands for one.
  const read = heading.map((w) => phrase.find((p) => sameWord(w, p)) ?? w);
  const has = new Set(read);
  if (!phrase.every((w) => has.has(w))) return 0;
  if (read.length === phrase.length && has.size === phrase.length) return 1; // same words, any order
  // The name sits inside a longer heading ("paid" in "total paid"): a fair fit, but only on a word that says something.
  return phrase.some((w) => !GENERIC.has(w)) ? 0.8 : 0;
}

const phrasesOf = (field: FieldSpec): string[][] => [field.key, ...field.aliases].map(words).filter((p) => p.length > 0);

const fieldScore = (heading: string, field: FieldSpec) => Math.max(0, ...phrasesOf(field).map((p) => phraseScore(words(heading), p)));

/** True when almost every filled cell reads as a date (a few stray cells are tolerated). */
function holdsDates(values: string[]): boolean {
  const filled = values.map((v) => v.trim()).filter(Boolean);
  if (filled.length === 0) return false;
  return filled.filter((v) => date(v).ok).length / filled.length >= 0.9;
}

/**
 * Columns found for the fields the file does not name exactly: field key -> heading in the file. Only fields the
 * importer could not match by name are considered, and only headings it did not use.
 */
export function smartMatch(kind: ImportKind, csv: string): Mapping {
  const header = headerOf(csv);
  const report = columnReport(kind, header);
  if (report.ambiguous) return {};
  const open = [...report.missingRequired, ...report.missingOptional];
  const out: Mapping = {};
  const taken = new Set<string>();

  // Pass 1: headings. Pairs are taken best first, each only when clearly the best for both the heading and the field.
  for (let round = 0; round < open.length; round++) {
    const fields = open.filter((f) => !(f.key in out));
    const headings = report.unused.filter((h) => !taken.has(h) && h.trim() !== "");
    const scored = fields.flatMap((f) => headings.map((h) => ({ f, h, s: fieldScore(h, f) }))).filter((c) => c.s >= ACCEPT);
    const clear = scored
      .filter((c) => scored.filter((o) => (o.h === c.h) !== (o.f === c.f)).every((o) => c.s - o.s >= MARGIN))
      .sort((a, b) => b.s - a.s)[0];
    if (!clear) break;
    out[clear.f.key] = clear.h;
    taken.add(clear.h);
  }

  // Pass 2: dates by what the column holds. Only when exactly one date field and exactly one column are left.
  const dateFields = open.filter((f) => !(f.key in out) && f.parse === date);
  if (dateFields.length === 1) {
    let records: string[][] = [];
    try {
      records = parseCsv(csv.replace(/^﻿/, "")).records.slice(1, 301);
    } catch {
      records = [];
    }
    const fits = report.unused.filter((h) => {
      if (taken.has(h) || h.trim() === "") return false;
      const i = header.indexOf(h);
      return i >= 0 && holdsDates(records.map((r) => r[i] ?? ""));
    });
    if (fits.length === 1) out[dateFields[0]!.key] = fits[0]!;
  }
  return out;
}

/**
 * The file type when the headings fit no type by name but exactly one type is fully covered once smart matching is
 * added (every required field found, at least three columns in all). Shown to the person as a guess to confirm.
 */
export function smartKind(csv: string, allowed?: readonly ImportKind[]): ImportKind | null {
  const header = headerOf(csv);
  const fits = IMPORT_ORDER.flatMap((kind) => {
    if ((allowed && !allowed.includes(kind)) || ruledOut(kind, header)) return [];
    const report = columnReport(kind, header);
    if (report.ambiguous) return [];
    const matched = smartMatch(kind, csv);
    if (report.missingRequired.some((f) => !(f.key in matched))) return [];
    const total = SPECS[kind].fields.length - report.missingRequired.length - report.missingOptional.length + Object.keys(matched).length;
    return total >= 3 ? [{ kind, total }] : [];
  });
  const best = Math.max(0, ...fits.map((f) => f.total));
  const top = fits.filter((f) => f.total === best);
  return top.length === 1 ? top[0]!.kind : null;
}

/** The file with the smart matches applied, and what was matched, for a screen that has no column picker (the demo). */
export function applySmartMatch(kind: ImportKind, csv: string): { csv: string; matched: Mapping } {
  const matched = smartMatch(kind, csv);
  return Object.keys(matched).length === 0 ? { csv, matched } : { csv: applyMapping(kind, csv, matched), matched };
}

/** Label for a field in messages: its first alias, as the column picker shows it. */
export const smartFieldLabel = (kind: ImportKind, key: string) => {
  const f = SPECS[kind].fields.find((x) => x.key === key);
  return f ? (f.aliases[0] ?? f.key) : key;
};
