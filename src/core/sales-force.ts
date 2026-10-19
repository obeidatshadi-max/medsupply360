/**
 * Rules for the sales force: the people the CEO makes responsible for products, customer accounts and tenders. Pure, so
 * the app and the demo apply the same checks and show progress the same way.
 */
export const NAME_MAX = 80;
export const EMAIL_MAX = 255;
export const SUPPLIERS_MAX = 30;
export const SUPPLIER_NAME_MAX = 200;
export const TARGET_MAX = 1_000_000_000;
export const NEW_ACCOUNTS_MAX = 1000;
export const VISITS_MAX = 100;

export type NameResult = { ok: true; name: string } | { ok: false; error: string };

/** A person's name: tidy spaces, drop control characters, at least 2 characters with a letter. Arabic and Latin both work. */
export function cleanPersonName(raw: unknown): NameResult {
  const name = String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f‎‏‪-‮]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (name.length < 2 || !/\p{L}/u.test(name)) return { ok: false, error: "Enter the person's name (at least 2 letters)." };
  if (name.length > NAME_MAX) return { ok: false, error: `Use ${NAME_MAX} characters or fewer for the name.` };
  return { ok: true, name };
}

/** What the CEO types for one sales person, exactly as posted. */
export interface SalesPersonForm {
  name: string;
  email: string;
  suppliers: string[];
  monthlySalesTarget: string;
  newAccountsTarget: string;
  visitsPerWeek: string;
}

export interface SalesPersonValues {
  name: string;
  email: string | null;
  supplierNames: string[];
  monthlySalesTarget: number | null;
  newAccountsTarget: number | null;
  visitsPerWeek: number | null;
}

export type SalesPersonResult = { ok: true; value: SalesPersonValues } | { ok: false; error: string };

function wholeNumber(raw: string, max: number, label: string): { ok: true; v: number | null } | { ok: false; error: string } {
  const t = raw.trim();
  if (t === "") return { ok: true, v: null };
  if (!/^\d+$/.test(t)) return { ok: false, error: `${label} must be a whole number, or empty.` };
  const n = Number(t);
  return n > max ? { ok: false, error: `${label} must be ${max} or less.` } : { ok: true, v: n };
}

export function cleanSalesPerson(form: SalesPersonForm): SalesPersonResult {
  const name = cleanPersonName(form.name);
  if (!name.ok) return name;

  const email = form.email.trim().toLowerCase();
  if (email !== "" && (email.length > EMAIL_MAX || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { ok: false, error: "Enter a valid email address, or leave it empty." };

  const seen = new Set<string>();
  const supplierNames: string[] = [];
  for (const raw of form.suppliers) {
    const s = raw.replace(/\s+/g, " ").trim();
    if (s === "" || seen.has(s.toLowerCase())) continue;
    if (s.length > SUPPLIER_NAME_MAX) return { ok: false, error: "A supplier name is too long." };
    seen.add(s.toLowerCase());
    supplierNames.push(s);
  }
  if (supplierNames.length > SUPPLIERS_MAX) return { ok: false, error: `Choose at most ${SUPPLIERS_MAX} suppliers.` };

  const targetText = form.monthlySalesTarget.replace(/[,\s]/g, "");
  let monthlySalesTarget: number | null = null;
  if (targetText !== "") {
    const n = Number(targetText);
    if (!/^\d+(\.\d{1,3})?$/.test(targetText) || !Number.isFinite(n) || n > TARGET_MAX) return { ok: false, error: "The monthly sales target must be a positive number in JOD, or empty." };
    monthlySalesTarget = n;
  }
  const accounts = wholeNumber(form.newAccountsTarget, NEW_ACCOUNTS_MAX, "New accounts per month");
  if (!accounts.ok) return accounts;
  const visits = wholeNumber(form.visitsPerWeek, VISITS_MAX, "Visits per week");
  if (!visits.ok) return visits;

  return { ok: true, value: { name: name.name, email: email === "" ? null : email, supplierNames, monthlySalesTarget, newAccountsTarget: accounts.v, visitsPerWeek: visits.v } };
}

/** Months of the year that have passed on `today` (YYYY-MM-DD), as a fraction: 15 March is about 2.5. */
export function elapsedMonths(today: string): number {
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Math.round(((m - 1) + d / daysInMonth) * 100) / 100;
}

export type TargetStatus = "on" | "behind" | "far" | "none";

export interface TargetProgress {
  status: TargetStatus;
  /** Year-to-date sales divided by what the monthly target adds up to so far, or null without a target. */
  ratio: number | null;
  /** The target for the months passed so far. */
  expected: number | null;
}

/** Sales so far this year against the monthly target for the months passed. 100% and over is on target, 70% and over is behind, below that far behind. */
export function targetProgress(ytdSales: number, monthlyTarget: number | null, today: string): TargetProgress {
  if (monthlyTarget === null || monthlyTarget <= 0) return { status: "none", ratio: null, expected: null };
  const expected = monthlyTarget * elapsedMonths(today);
  if (expected <= 0) return { status: "none", ratio: null, expected: null };
  const ratio = ytdSales / expected;
  return { status: ratio >= 1 ? "on" : ratio >= 0.7 ? "behind" : "far", ratio, expected };
}

export const TARGET_WORD: Record<TargetStatus, string> = { on: "On target", behind: "Behind", far: "Well behind", none: "No target set" };

/** The `owner` filter in the tender list's address: "none", one person's id, or empty for everyone. */
export type OwnerFilter = { kind: "all" } | { kind: "none" } | { kind: "owner"; id: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v: string): boolean => UUID.test(v);

export function parseOwnerFilter(raw: string): OwnerFilter {
  if (raw === "none") return { kind: "none" };
  return UUID.test(raw) ? { kind: "owner", id: raw.toLowerCase() } : { kind: "all" };
}

export function matchesOwner(f: OwnerFilter, ownerId: string | null): boolean {
  if (f.kind === "all") return true;
  if (f.kind === "none") return ownerId === null;
  return ownerId?.toLowerCase() === f.id;
}
