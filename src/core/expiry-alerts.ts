/**
 * Service contracts and warranties that end soon, in one list. Pure, so the app and the demo build it the same way.
 *
 * It uses only dates somebody recorded: a contract end date and a warranty end date on the equipment list. A machine with no
 * date is not in the list (it cannot be told apart from a machine that is fine), and the page says how many are not covered.
 */
import type { UnitInput } from "./installed-base";

export type ExpiryKind = "contract" | "warranty";

/** How far ahead the list looks, and how far back it keeps a date that has just passed (still worth a call). */
export const EXPIRY_WINDOW_DAYS = 90;
export const ENDED_LOOKBACK_DAYS = 30;

export type ExpiryBucket = "ended" | "30" | "60" | "90";

export const BUCKET_LABEL: Record<ExpiryBucket, string> = {
  ended: "Ended in the last 30 days",
  "30": "Ends within 30 days",
  "60": "Ends in 31 to 60 days",
  "90": "Ends in 61 to 90 days",
};

export const BUCKETS: readonly ExpiryBucket[] = ["ended", "30", "60", "90"];

export const KIND_LABEL: Record<ExpiryKind, string> = { contract: "Service contract", warranty: "Warranty" };

export interface ExpiryItem {
  unitCode: string;
  unitName: string;
  customerCode: string;
  customerName: string;
  kind: ExpiryKind;
  /** The end date, YYYY-MM-DD. */
  date: string;
  /** Days from today to the end date; negative once it has ended. */
  days: number;
  bucket: ExpiryBucket;
  contact: string | null;
}

const DAY = 86_400_000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

/** The bucket a number of days falls in, or null when it is outside the window. */
export function bucketOf(days: number): ExpiryBucket | null {
  if (days < -ENDED_LOOKBACK_DAYS || days > EXPIRY_WINDOW_DAYS) return null;
  if (days < 0) return "ended";
  if (days <= 30) return "30";
  if (days <= 60) return "60";
  return "90";
}

const contactText = (u: UnitInput): string | null => {
  const parts = [u.contactName, u.contactPhone, u.contactEmail].filter((p): p is string => typeof p === "string" && p.trim() !== "");
  return parts.length === 0 ? null : parts.join(" · ");
};

/** Every contract or warranty that ended in the last 30 days or ends within 90, soonest date first. */
export function buildExpiryList(units: readonly UnitInput[], today: string): ExpiryItem[] {
  const items: ExpiryItem[] = [];
  for (const u of units) {
    for (const [kind, date] of [["contract", u.contractEnd], ["warranty", u.warrantyEnd]] as const) {
      if (!date) continue;
      const days = daysBetween(today, date);
      const bucket = bucketOf(days);
      if (bucket === null) continue;
      items.push({ unitCode: u.code, unitName: u.name, customerCode: u.customerCode, customerName: u.customerName, kind, date, days, bucket, contact: contactText(u) });
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.unitName.localeCompare(b.unitName) || a.kind.localeCompare(b.kind));
}

export interface ExpirySummary {
  total: number;
  byBucket: Record<ExpiryBucket, number>;
  byKind: Record<ExpiryKind, number>;
  /** Machines with neither date: the list says nothing about them. */
  machinesWithoutDates: number;
}

export function summarizeExpiry(items: readonly ExpiryItem[], units: readonly UnitInput[]): ExpirySummary {
  const byBucket: Record<ExpiryBucket, number> = { ended: 0, "30": 0, "60": 0, "90": 0 };
  const byKind: Record<ExpiryKind, number> = { contract: 0, warranty: 0 };
  for (const i of items) {
    byBucket[i.bucket]++;
    byKind[i.kind]++;
  }
  return { total: items.length, byBucket, byKind, machinesWithoutDates: units.filter((u) => !u.contractEnd && !u.warrantyEnd).length };
}

/** "in 12 days", "today", "3 days ago" for the Days column. */
export function daysText(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}
