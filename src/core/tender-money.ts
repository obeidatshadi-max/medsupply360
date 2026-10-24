/**
 * The money side of a tender: bank guarantees and the invoices raised once goods are delivered. Pure rules shared by the
 * screens, the server and the tests. Amounts are JOD with three decimals (fils).
 */

export const GUARANTEE_KINDS = ["bid", "performance"] as const;
export type GuaranteeKind = (typeof GUARANTEE_KINDS)[number];
export const GUARANTEE_LABEL: Record<GuaranteeKind, string> = { bid: "Bid guarantee", performance: "Performance guarantee" };

export interface GuaranteeDates {
  expiresOn: string;
  returnedOn: string | null;
}

export type GuaranteeState = { state: "returned" } | { state: "expired"; daysAgo: number } | { state: "active"; daysLeft: number };

const DAY = 86_400_000;
const wholeDays = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

/**
 * Where a guarantee stands today. A returned guarantee no longer ties up money. Otherwise it is active until the day after
 * its expiry date. Only plain days are reported: no "expiring soon" limit is imposed.
 */
export function guaranteeState(g: GuaranteeDates, today: string): GuaranteeState {
  if (g.returnedOn) return { state: "returned" };
  const left = wholeDays(today, g.expiresOn);
  return left >= 0 ? { state: "active", daysLeft: left } : { state: "expired", daysAgo: -left };
}

/** Money held by active guarantees: not returned and not past expiry. Expired but unreturned guarantees are counted apart. */
export function guaranteeExposure(rows: (GuaranteeDates & { amount: number })[], today: string): { active: number; expiredNotReturned: number } {
  let active = 0;
  let expiredNotReturned = 0;
  for (const g of rows) {
    const s = guaranteeState(g, today);
    if (s.state === "active") active += g.amount;
    else if (s.state === "expired") expiredNotReturned += g.amount;
  }
  return { active: round3(active), expiredNotReturned: round3(expiredNotReturned) };
}

export interface InvoiceAmounts {
  amount: number;
  collected: number;
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

export function paymentSummary(rows: InvoiceAmounts[]): { invoiced: number; collected: number; outstanding: number; fullyCollected: boolean } {
  const invoiced = round3(rows.reduce((s, r) => s + r.amount, 0));
  const collected = round3(rows.reduce((s, r) => s + Math.min(r.collected, r.amount), 0));
  const outstanding = round3(invoiced - collected);
  return { invoiced, collected, outstanding, fullyCollected: rows.length > 0 && outstanding === 0 };
}

/** Why a tender cannot be marked Collected yet, or null when it can. */
export function collectionBlocker(rows: InvoiceAmounts[]): string | null {
  if (rows.length === 0) return "record at least one invoice";
  const { outstanding } = paymentSummary(rows);
  return outstanding > 0 ? `collect the remaining JOD ${outstanding.toFixed(3)} on the invoices` : null;
}

/** A calendar date plus whole days, as YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

/**
 * When an invoice is expected to be paid: the date typed on the invoice, else the invoice date plus the tender's payment
 * terms, else unknown. A typed date always wins, so a one-off agreement never needs the terms changed.
 */
export function effectiveDueDate(inv: { invoiceDate: string; dueDate: string | null }, termsDays: number | null): string | null {
  if (inv.dueDate) return inv.dueDate;
  return termsDays === null ? null : addDays(inv.invoiceDate, termsDays);
}

export type DueState = { state: "paid" } | { state: "unknown" } | { state: "not-due"; daysLeft: number } | { state: "overdue"; daysAgo: number };

/** Where one invoice stands today. An invoice is overdue from the day AFTER its due date. */
export function dueState(inv: InvoiceAmounts & { dueDate: string | null }, today: string): DueState {
  if (round3(inv.amount - Math.min(inv.collected, inv.amount)) === 0) return { state: "paid" };
  if (!inv.dueDate) return { state: "unknown" };
  const left = wholeDays(today, inv.dueDate);
  return left >= 0 ? { state: "not-due", daysLeft: left } : { state: "overdue", daysAgo: -left };
}

export interface Aging {
  /** Unpaid money not yet due, overdue, and with no due date known. They add up to the total unpaid. */
  notYetDue: number;
  overdue: number;
  noDueDate: number;
  overdueInvoices: number;
  /** Days the longest-overdue unpaid invoice is past due, or null when nothing is overdue. */
  oldestOverdueDays: number | null;
}

/** Splits the unpaid part of invoices by whether it is due yet. `dueDate` is the effective due date (see `effectiveDueDate`). */
export function receivableAging(rows: (InvoiceAmounts & { dueDate: string | null })[], today: string): Aging {
  const out = { notYetDue: 0, overdue: 0, noDueDate: 0, overdueInvoices: 0, oldestOverdueDays: null as number | null };
  for (const r of rows) {
    const unpaid = round3(r.amount - Math.min(r.collected, r.amount));
    const s = dueState(r, today);
    if (s.state === "paid") continue;
    if (s.state === "unknown") out.noDueDate += unpaid;
    else if (s.state === "not-due") out.notYetDue += unpaid;
    else {
      out.overdue += unpaid;
      out.overdueInvoices += 1;
      out.oldestOverdueDays = Math.max(out.oldestOverdueDays ?? 0, s.daysAgo);
    }
  }
  return { ...out, notYetDue: round3(out.notYetDue), overdue: round3(out.overdue), noDueDate: round3(out.noDueDate) };
}
