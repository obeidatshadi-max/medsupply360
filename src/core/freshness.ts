export type FreshnessLevel = "current" | "aging" | "stale";

export interface FreshnessInput {
  /** Jordan business date, YYYY-MM-DD. */
  today: string;
  /** Latest date found in each imported file; null when that file has never been imported. */
  latestInvoice: string | null;
  latestReceipt: string | null;
  openInvoicesAsOf: string | null;
  stockAsOf: string | null;
}

export interface FreshnessItem {
  key: "sales" | "cash" | "receivables" | "stock";
  label: string;
  /** Latest date in the data, or null when the file is missing. */
  asOf: string | null;
  /** Whole days between asOf and today; never negative. Null when the file is missing. */
  daysOld: number | null;
  level: FreshnessLevel;
}

export interface Freshness {
  items: FreshnessItem[];
  /** Worst level among the files that were imported. */
  level: FreshnessLevel;
  /** Oldest imported date, or null when nothing was imported. */
  oldestAsOf: string | null;
}

/** Days after which a file is called "aging" and then "stale". */
export const AGING_AFTER_DAYS = 10;
export const STALE_AFTER_DAYS = 31;

const DAY = 86_400_000;

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / DAY));
}

function levelFor(daysOld: number): FreshnessLevel {
  if (daysOld > STALE_AFTER_DAYS) return "stale";
  if (daysOld > AGING_AFTER_DAYS) return "aging";
  return "current";
}

const RANK: Record<FreshnessLevel, number> = { current: 0, aging: 1, stale: 2 };

/**
 * How old each imported file's data is. A file that was never imported is reported as missing, not stale: the overview
 * already shows a dash for it. A date after today (clock skew, invoices dated tomorrow) counts as 0 days old.
 */
export function assessFreshness(input: FreshnessInput): Freshness {
  const raw: [FreshnessItem["key"], string, string | null][] = [
    ["sales", "Sales", input.latestInvoice],
    ["cash", "Cash received", input.latestReceipt],
    ["receivables", "Unpaid invoices", input.openInvoicesAsOf],
    ["stock", "Stock", input.stockAsOf],
  ];
  const items: FreshnessItem[] = raw.map(([key, label, asOf]) => {
    if (!asOf) return { key, label, asOf: null, daysOld: null, level: "current" };
    const daysOld = daysBetween(asOf, input.today);
    return { key, label, asOf, daysOld, level: levelFor(daysOld) };
  });
  const imported = items.filter((i) => i.asOf);
  const level = imported.reduce<FreshnessLevel>((worst, i) => (RANK[i.level] > RANK[worst] ? i.level : worst), "current");
  const oldestAsOf = imported.map((i) => i.asOf as string).sort()[0] ?? null;
  return { items, level, oldestAsOf };
}

/** The end date for a year-to-date window: the latest data date, but never later than today. */
export function windowEnd(today: string, latest: string | null): string {
  if (!latest || latest > today) return today;
  return latest;
}
