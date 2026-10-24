/**
 * What a sales person actually did, set against what the CEO expects: new accounts in the month and customer visits in
 * the week. Pure, so the app and the demo count and judge them the same way.
 */
import { isIsoDate } from "./calc";

export const VISIT_NOTE_MAX = 300;
/** A visit may be entered up to this many days after it happened. */
export const VISIT_BACKDATE_DAYS = 120;

const DAY_MS = 86_400_000;
const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The Monday of the week that contains `day` (YYYY-MM-DD). Weeks run Monday to Sunday. */
export function weekStart(day: string): string {
  const dow = (new Date(toMs(day)).getUTCDay() + 6) % 7; // Monday = 0
  return toDay(toMs(day) - dow * DAY_MS);
}

/** The last day of the week that starts on `monday`. */
export const weekEnd = (monday: string): string => toDay(toMs(monday) + 6 * DAY_MS);

export const monthOf = (day: string): string => day.slice(0, 7);

/**
 * Accounts that placed their first order in `month` (YYYY-MM). A customer with no invoice yet is not new, and one whose
 * first invoice is older is an existing account.
 */
export function newAccountsInMonth(firstInvoiceDates: readonly (string | null)[], month: string): number {
  return firstInvoiceDates.filter((d) => d !== null && monthOf(d) === month).length;
}

export type ActivityStatus = "on" | "behind" | "none";

export interface ActivityProgress {
  status: ActivityStatus;
  /** Done divided by the target, or null without a target. */
  ratio: number | null;
}

/** 100% and over is on target; anything less is behind. No target set means nothing to judge. */
export function activityProgress(done: number, target: number | null): ActivityProgress {
  if (target === null || target <= 0) return { status: "none", ratio: null };
  const ratio = done / target;
  return { status: ratio >= 1 ? "on" : "behind", ratio };
}

export interface VisitForm {
  visitedOn: string;
  customerId: string;
  note: string;
}

export interface VisitValues {
  visitedOn: string;
  customerId: string | null;
  note: string | null;
}

export type VisitResult = { ok: true; value: VisitValues } | { ok: false; error: string };

export function cleanVisit(form: VisitForm, today: string): VisitResult {
  const date = form.visitedOn.trim();
  if (!isIsoDate(date)) return { ok: false, error: "Enter the date of the visit." };
  if (date > today) return { ok: false, error: "A visit cannot be dated in the future." };
  if (toMs(today) - toMs(date) > VISIT_BACKDATE_DAYS * DAY_MS) return { ok: false, error: `A visit can be entered up to ${VISIT_BACKDATE_DAYS} days after it happened.` };
  const note = form.note.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").trim();
  if (note.length > VISIT_NOTE_MAX) return { ok: false, error: `Use ${VISIT_NOTE_MAX} characters or fewer for the note.` };
  return { ok: true, value: { visitedOn: date, customerId: form.customerId.trim() === "" ? null : form.customerId.trim(), note: note === "" ? null : note } };
}
