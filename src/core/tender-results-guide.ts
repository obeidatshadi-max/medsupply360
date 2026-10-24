/**
 * The "Tender results" file, described once for people: the page that explains it, the template download and the sample
 * file all read this list, so they cannot drift apart. A test checks that every column here is read by the importer.
 */
export type ColumnLevel = "required" | "helpful" | "optional";

export interface GuideColumn {
  /** The heading used in the template. The importer also accepts other spellings (see SPECS.tender_results). */
  column: string;
  level: ColumnLevel;
  note: string;
  example: string;
}

export const TENDER_RESULTS_GUIDE: readonly GuideColumn[] = [
  { column: "authority", level: "required", note: "Who ran the tender: MOH, KHCC, DRMS, JUH or KAUH. The full name is also accepted.", example: "MOH" },
  { column: "tender no", level: "required", note: "The authority's tender number, exactly as printed.", example: "MOH/2025/14" },
  { column: "award date", level: "required", note: "The day the award was announced. Day/month/year or 2025-03-01.", example: "2025-03-01" },
  { column: "item", level: "required", note: "The item as the tender calls it. The same wording in two tenders counts as the same item.", example: "Glucose test strips 50" },
  { column: "bidder", level: "required", note: "The company that made the offer. Include your own offers and the winner.", example: "Sadaf Medical" },
  { column: "our bid", level: "helpful", note: "yes for your own offers, no for everyone else.", example: "yes" },
  { column: "unit price", level: "helpful", note: "Price of one unit. Leave empty when the authority did not publish it: an empty price is treated as unknown, never as zero.", example: "4.250" },
  { column: "result", level: "helpful", note: "won, lost, disqualified or withdrawn. Leave empty when not stated.", example: "won" },
  { column: "quantity", level: "helpful", note: "What the authority asked for. Needed to value the award and to work out a unit price from a line total.", example: "20000" },
  { column: "line total", level: "optional", note: "Use when the notice shows only the total for the line. With the quantity, the unit price is worked out.", example: "85000" },
  { column: "therapeutic area", level: "optional", note: "For example Diabetes or Haematology. Filled from your product list when the item code matches.", example: "Diabetes" },
  { column: "item code", level: "optional", note: "Your own product code. Links the item to your product list.", example: "GS-50" },
  { column: "tender title", level: "optional", note: "The tender's subject.", example: "Diabetes testing supplies" },
  { column: "unit", level: "optional", note: "Pack, box, test, piece.", example: "pack" },
  { column: "currency", level: "optional", note: "JOD when empty. Prices in other currencies are kept but never compared.", example: "JOD" },
  { column: "technical pass", level: "optional", note: "yes or no, when the notice shows the technical result.", example: "yes" },
  { column: "awarded quantity", level: "optional", note: "When the award covered only part of the quantity.", example: "15000" },
  { column: "brand", level: "optional", note: "Make or country of origin.", example: "Acme (Germany)" },
] as const;

const cell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** CSV text, headings first, with a UTF-8 byte-order mark so Excel opens Arabic text correctly. */
export function toCsv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return "\uFEFF" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** The empty template: headings only, so nothing made up can be imported by mistake. The examples are on the page. */
export function templateCsv(): string {
  return toCsv(
    TENDER_RESULTS_GUIDE.map((c) => c.column),
    [],
  );
}
