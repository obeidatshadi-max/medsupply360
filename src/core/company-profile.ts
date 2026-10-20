/**
 * The company profile: who the company is, in the owner's own words. Pure, so the form and the tests share one set of
 * rules. The company name is set when the account is created and is not edited here. The accounting system is typed
 * text (for example "Alpha ERP"); it is information for readers, and the importer does not depend on it.
 */

export const LIMITS = { location: 160, address: 1000, team: 160, audience: 1500, purpose: 2000, erp: 160, notes: 4000 } as const;
export const FOUNDED_MIN = 1800;

export interface ProfileForm {
  location: string;
  address: string;
  founded: string;
  team: string;
  audience: string;
  purpose: string;
  erp: string;
  notes: string;
}

/** What is stored: every field is text, empty when the owner has not written it. */
export type ProfileValues = ProfileForm;

export const emptyProfile: ProfileValues = { location: "", address: "", founded: "", team: "", audience: "", purpose: "", erp: "", notes: "" };

export type ProfileResult = { ok: true; value: ProfileValues } | { ok: false; error: string };

/** Single-line text: tidy spaces and drop control characters. */
const line = (v: unknown) =>
  String(v ?? "")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f‎‏‪-‮]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();

/** Longer text keeps its line breaks, so an address or a note can run over several lines. */
const block = (v: unknown) =>
  String(v ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f‎‏‪-‮]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export function cleanProfile(form: ProfileForm, thisYear: number): ProfileResult {
  const out: ProfileValues = {
    location: line(form.location),
    address: block(form.address),
    founded: line(form.founded),
    team: line(form.team),
    audience: block(form.audience),
    purpose: block(form.purpose),
    erp: line(form.erp),
    notes: block(form.notes),
  };
  const names: Record<keyof typeof LIMITS, string> = { location: "location", address: "address", team: "team description", audience: "customers", purpose: "business purpose", erp: "accounting system", notes: "notes" };
  for (const key of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    if (out[key].length > LIMITS[key]) return { ok: false, error: `Use ${LIMITS[key]} characters or fewer for the ${names[key]}.` };
  }
  if (out.founded !== "") {
    const year = /^\d{4}$/.test(out.founded) ? Number(out.founded) : NaN;
    if (!(year >= FOUNDED_MIN && year <= thisYear)) return { ok: false, error: `Enter the year the company was founded, four digits between ${FOUNDED_MIN} and ${thisYear}, or leave it empty.` };
  }
  return { ok: true, value: out };
}

/** The labels of what the owner has not written yet, so the page can say what would complete the profile. */
export function missingFromProfile(p: ProfileValues): string[] {
  const labels: [keyof ProfileValues, string][] = [
    ["location", "location"],
    ["founded", "founding year"],
    ["audience", "who the company serves"],
    ["purpose", "business purpose"],
    ["erp", "accounting system"],
  ];
  return labels.filter(([key]) => p[key] === "").map(([, label]) => label);
}

export interface SupplierSummary {
  name: string;
  products: number;
  activeProducts: number;
}

/** Years in business, or null when the founding year is not written. */
export function yearsInBusiness(founded: string, thisYear: number): number | null {
  return /^\d{4}$/.test(founded) ? Math.max(0, thisYear - Number(founded)) : null;
}
