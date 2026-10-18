/**
 * Owner-brief signals: turns a few headline figures into a status (good / watch / act / nodata) per topic and a
 * short list of things that need attention. Pure (no React, no I/O) so the thresholds are unit-testable.
 *
 * The thresholds are management rules of thumb, not accounting rules. They are shown on screen as "how we judge".
 */
export type Status = "good" | "watch" | "act" | "nodata";

export const THRESHOLDS = {
  /** Growth against the same dates last year: below 0 = watch, below this = act. */
  growthAct: -0.1,
  /** Share of unpaid invoices that is overdue. */
  overdueWatch: 0.1,
  overdueAct: 0.25,
  /** Share of owned stock that is slow or unused. */
  slowWatch: 0.15,
  slowAct: 0.3,
  /** Estimated expiry loss as a share of owned stock. */
  expiryWatch: 0.03,
  expiryAct: 0.08,
} as const;

const worst = (...s: Status[]): Status => (s.includes("act") ? "act" : s.includes("watch") ? "watch" : s.includes("good") ? "good" : "nodata");

/** Trend against last year. A value that is not a number (missing data) gives "nodata". */
export function trendStatus(growth: number | string | null | undefined): Status {
  if (typeof growth !== "number" || !Number.isFinite(growth)) return "nodata";
  if (growth >= 0) return "good";
  return growth < THRESHOLDS.growthAct ? "act" : "watch";
}

export function shareStatus(share: number | null | undefined, watch: number, act: number): Status {
  if (typeof share !== "number" || !Number.isFinite(share)) return "nodata";
  return share >= act ? "act" : share >= watch ? "watch" : "good";
}

const ratio = (part: number, whole: number): number | null => (whole > 0 ? part / whole : null);

export interface BriefInput {
  /** Growth ratios (0.1 = +10%); a string or undefined means the comparison is not available. */
  salesGrowth?: number | string | null;
  cashGrowth?: number | string | null;
  /** Unpaid invoices: overdue part and total, or null when no file has been imported. */
  receivables: { overdue: number; total: number } | null;
  /** Owned stock: slow/unused value, total value and estimated expiry loss, or null when no file. */
  stock: { slow: number; total: number; expiryLoss: number } | null;
}

export interface BriefSignals {
  sales: Status;
  cash: Status;
  overdue: Status;
  overdueShare: number | null;
  stock: Status;
  slowShare: number | null;
  expiryShare: number | null;
}

export function briefSignals(i: BriefInput): BriefSignals {
  const overdueShare = i.receivables ? ratio(i.receivables.overdue, i.receivables.total) : null;
  const slowShare = i.stock ? ratio(i.stock.slow, i.stock.total) : null;
  const expiryShare = i.stock ? ratio(i.stock.expiryLoss, i.stock.total) : null;
  // A file with no unpaid invoices at all is good news, not "no data".
  const overdue = !i.receivables ? "nodata" : i.receivables.total === 0 ? "good" : shareStatus(overdueShare, THRESHOLDS.overdueWatch, THRESHOLDS.overdueAct);
  const stock = !i.stock
    ? "nodata"
    : worst(shareStatus(slowShare, THRESHOLDS.slowWatch, THRESHOLDS.slowAct), shareStatus(expiryShare, THRESHOLDS.expiryWatch, THRESHOLDS.expiryAct));
  return {
    sales: trendStatus(i.salesGrowth),
    cash: trendStatus(i.cashGrowth),
    overdue,
    overdueShare,
    stock,
    slowShare,
    expiryShare,
  };
}

export interface Alert {
  topic: "sales" | "cash" | "overdue" | "stock";
  level: "act" | "watch";
  text: string;
  href: string;
}

/** Plain-language attention list, most serious first. Empty when nothing needs the owner. */
export function briefAlerts(s: BriefSignals, money: { overdue?: string; expiry?: string; slow?: string }): Alert[] {
  const out: Alert[] = [];
  const add = (topic: Alert["topic"], status: Status, act: string, watch: string, href: string) => {
    if (status === "act") out.push({ topic, level: "act", text: act, href });
    else if (status === "watch") out.push({ topic, level: "watch", text: watch, href });
  };
  add(
    "overdue",
    s.overdue,
    `${money.overdue ?? "A large amount"} is overdue from customers. Call the biggest accounts first.`,
    `${money.overdue ?? "Some money"} is overdue from customers.`,
    "/finance",
  );
  add("cash", s.cash, "Cash collected is well below the same dates last year.", "Cash collected is a little below the same dates last year.", "/finance");
  add("sales", s.sales, "Sales are well below the same dates last year.", "Sales are a little below the same dates last year.", "/finance");
  add(
    "stock",
    s.stock,
    `Stock is at risk: ${money.slow ?? "a large part"} is slow or unused, and ${money.expiry ?? "some"} may expire unsold.`,
    `Some stock is slow or close to expiry (${money.expiry ?? "estimate"} possible loss).`,
    "/inventory",
  );
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === "act" ? -1 : 1));
}
