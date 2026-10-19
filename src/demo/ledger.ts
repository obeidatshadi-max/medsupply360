/**
 * Synthetic transaction-level data for the promotional demo, run through the SAME calculation code as the app
 * (receivables aging, week-on-week change, reorder timing and opportunity ranking). Everything here is invented and
 * built to agree with the demo's headline figures: the overdue invoices are the demo's own, and the monthly cash
 * adds up to the demo's year-to-date collections.
 */
import { lines, invoices as demoInvoices, DEMO_AS_OF, type LineName } from "./dataset";
import { buildReceivables, type OpenInvoiceRow } from "@/core/receivables";
import { buildOpportunities, type OrderRow } from "@/core/opportunities";
import { change, weekWindows } from "@/core/weekly";
import { roundJod } from "@/core/calc";
import { buildPortfolio, type SalesRow } from "@/core/portfolio";

type Line = LineName | "All lines";

interface OpenInvoice extends OpenInvoiceRow {
  line: LineName;
}

const open = (invoiceNo: string, customerName: string, line: LineName, remaining: number, dueDate: string | null): OpenInvoice => ({
  invoiceNo,
  customerCode: customerName,
  customerName,
  line,
  remaining,
  dueDate,
});

/** Unpaid invoices at the demo snapshot: the demo's four overdue ones plus three that are not overdue or have no due date. */
const OPEN_NOW: OpenInvoice[] = [
  ...demoInvoices.map((i, n) => open(`DEMO-${n + 1}`, i.account, i.line, i.value, i.due)),
  open("DEMO-5", "Jordan Valley Public Hospitals Group", "Equipment", 41380, "2026-10-28"),
  open("DEMO-6", "Khalda Garden Private Hospital", "Consumables", 9265, "2026-10-20"),
  open("DEMO-7", "Eastern Badia Regional Medical Center", "Devices", 12730, null),
];
/** One invoice that was unpaid a week earlier and was paid on 3 October. */
const PAID_LAST_WEEK = open("DEMO-8", "Jabal Amman University Hospital", "Consumables", 31260, "2026-09-15");
const PREVIOUS_SNAPSHOT = "2026-10-01";

const MONTH_WEIGHTS = [0.095, 0.1, 0.105, 0.108, 0.112, 0.118, 0.115, 0.121, 0.126];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];

const RECEIPTS: { date: string; amount: number }[] = [
  { date: "2026-09-26", amount: 17845 },
  { date: "2026-09-30", amount: 39720 },
  { date: "2026-10-03", amount: 31260 },
  { date: "2026-10-06", amount: 24380 },
  { date: "2026-10-08", amount: 12115 },
];

const CUSTOMERS: { name: string; cycle: number; last: string; count: number; value: number }[] = [
  { name: "Jordan Valley Public Hospitals Group", cycle: 28, last: "2026-10-05", count: 10, value: 45820 },
  { name: "Jabal Amman University Hospital", cycle: 30, last: "2026-07-28", count: 9, value: 38460 },
  { name: "Red Sea Specialty Hospital", cycle: 45, last: "2026-10-07", count: 8, value: 60730 },
  { name: "Eastern Badia Regional Medical Center", cycle: 35, last: "2026-09-29", count: 7, value: 27340 },
  { name: "Dabouq Heights Private Hospital", cycle: 21, last: "2026-06-30", count: 12, value: 15870 },
  { name: "Irbid Al-Wasl Surgical Center", cycle: 40, last: "2026-10-01", count: 6, value: 21960 },
  { name: "Rawabi Wound and Diabetes Clinic", cycle: 14, last: "2026-09-14", count: 11, value: 9640 },
  { name: "Khalda Garden Private Hospital", cycle: 30, last: "2026-09-10", count: 3, value: 12250 },
];

const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

const ORDERS: OrderRow[] = CUSTOMERS.flatMap((c) =>
  Array.from({ length: c.count }, (_, k) => ({
    customerCode: c.name,
    customerName: c.name,
    date: addDays(c.last, -k * c.cycle),
    value: roundJod(c.value * [1, 1.05, 0.95][k % 3]!),
  })),
);

export function demoLedger(line: Line = "All lines") {
  const asOf = DEMO_AS_OF;
  const w = weekWindows(asOf);
  const pick = (rows: OpenInvoice[]) => rows.filter((r) => line === "All lines" || r.line === line);

  const aging = buildReceivables(pick(OPEN_NOW), asOf, 100);

  const cashMonths = MONTHS.map((label) => ({ label, amount: 0 }));
  for (const l of lines.filter((x) => line === "All lines" || x.name === line)) {
    let used = 0;
    cashMonths.forEach((m, i) => {
      const amount = i === MONTHS.length - 1 ? l.col - used : Math.round(l.col * MONTH_WEIGHTS[i]!);
      used += amount;
      m.amount += amount;
    });
  }
  const octToDate = RECEIPTS.filter((r) => r.date >= "2026-10-01").reduce((s, r) => s + r.amount, 0);

  // Company-wide views: orders and receipts are not split by line.
  const inWindow = (d: string, from: string, to: string) => d >= from && d <= to;
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const salesIn = (from: string, to: string) => sum(ORDERS.filter((o) => inWindow(o.date, from, to)).map((o) => o.value));
  const ordersIn = (from: string, to: string) => ORDERS.filter((o) => inWindow(o.date, from, to)).length;
  const cashIn = (from: string, to: string) => sum(RECEIPTS.filter((r) => inWindow(r.date, from, to)).map((r) => r.amount));

  const allNow = buildReceivables(OPEN_NOW, asOf, 100);
  const before = buildReceivables([...OPEN_NOW, PAID_LAST_WEEK], PREVIOUS_SNAPSHOT, 0);

  const overdueMap = new Map(allNow.topOverdue.map((c) => [c.customerCode, { name: c.customerName, amount: c.overdue }]));
  const opportunities = buildOpportunities(ORDERS, overdueMap, asOf);

  const thisWeek = ORDERS.filter((o) => inWindow(o.date, w.thisFrom, w.thisTo)).reduce<Record<string, number>>(
    (m, o) => ({ ...m, [o.customerName]: (m[o.customerName] ?? 0) + o.value }),
    {},
  );

  return {
    asOf,
    aging,
    cashMonths,
    cashJanSep: cashMonths.reduce((s, m) => s + m.amount, 0),
    octToDate,
    opportunities,
    weekly: {
      windows: w,
      sales: change(salesIn(w.thisFrom, w.thisTo), salesIn(w.prevFrom, w.prevTo)),
      cash: change(cashIn(w.thisFrom, w.thisTo), cashIn(w.prevFrom, w.prevTo)),
      orders: change(ordersIn(w.thisFrom, w.thisTo), ordersIn(w.prevFrom, w.prevTo)),
      overdue: change(allNow.overdue, before.overdue),
      overdueBeforeAsOf: PREVIOUS_SNAPSHOT,
      topCustomers: Object.entries(thisWeek)
        .map(([name, sales]) => ({ name, sales }))
        .sort((a, b) => b.sales - a.sales),
    },
  };
}

// ─── Portfolio growth (synthetic) ────────────────────────────────────────────

type Seg = "Tender" | "Private";
const PORTFOLIO_CUSTOMERS: Record<string, Seg> = {
  "Jordan Valley Public Hospitals Group": "Tender",
  "Jabal Amman University Hospital": "Tender",
  "Red Sea Specialty Hospital": "Tender",
  "Eastern Badia Regional Medical Center": "Tender",
  "Dabouq Heights Private Hospital": "Private",
  "Irbid Al-Wasl Surgical Center": "Private",
  "Rawabi Wound and Diabetes Clinic": "Private",
  "Khalda Garden Private Hospital": "Private",
};

/** Synthetic area table. `cur` rows add up to the demo's year-to-date sales (JOD 4.54M). Weights are per customer. */
const AREAS: { area: string | null; cur: number; prior: number; wCur: number[]; wPrior: number[]; products: number; suppliers: number }[] = [
  { area: "Respiratory", cur: 823640, prior: 604120, wCur: [10, 12, 8, 6, 30, 14, 6, 14], wPrior: [14, 16, 10, 8, 22, 10, 8, 12], products: 2, suppliers: 1 },
  { area: "Surgery and electrosurgery", cur: 716380, prior: 384730, wCur: [75, 4, 6, 3, 4, 5, 1, 2], wPrior: [45, 8, 12, 6, 8, 12, 2, 7], products: 3, suppliers: 2 },
  { area: "Infusion and critical care", cur: 653920, prior: 526480, wCur: [14, 16, 10, 8, 18, 20, 6, 8], wPrior: [16, 18, 12, 10, 16, 16, 6, 6], products: 4, suppliers: 1 },
  { area: "Critical care monitoring", cur: 641570, prior: 557260, wCur: [20, 18, 14, 10, 16, 10, 4, 8], wPrior: [20, 18, 14, 10, 16, 10, 4, 8], products: 6, suppliers: 3 },
  { area: "Wound care", cur: 564810, prior: 597840, wCur: [6, 8, 6, 4, 22, 18, 30, 6], wPrior: [6, 8, 6, 4, 22, 18, 30, 6], products: 7, suppliers: 3 },
  { area: "Infection control", cur: 477290, prior: 514950, wCur: [18, 20, 16, 14, 12, 8, 4, 8], wPrior: [18, 20, 16, 14, 12, 8, 4, 8], products: 5, suppliers: 2 },
  { area: "Neurology and psychiatry", cur: 402350, prior: 483610, wCur: [12, 30, 8, 4, 24, 8, 4, 10], wPrior: [12, 30, 8, 4, 24, 8, 4, 10], products: 4, suppliers: 2 },
  { area: null, cur: 260053, prior: 246380, wCur: [15, 15, 15, 10, 15, 10, 10, 10], wPrior: [15, 15, 15, 10, 15, 10, 10, 10], products: 0, suppliers: 0 },
];

function spread(total: number, weights: number[]): number[] {
  const w = weights.reduce((a, b) => a + b, 0);
  const parts = weights.map((x) => Math.round((total * x) / w));
  parts[0] = parts[0]! + (total - parts.reduce((a, b) => a + b, 0));
  return parts;
}

export function demoPortfolio() {
  const names = Object.keys(PORTFOLIO_CUSTOMERS);
  const rows: SalesRow[] = AREAS.flatMap((a) => {
    const cur = spread(a.cur, a.wCur);
    const prior = spread(a.prior, a.wPrior);
    return names.flatMap((customer, i) => [
      { area: a.area, segment: PORTFOLIO_CUSTOMERS[customer]!, customer, period: "current" as const, sales: cur[i]! },
      { area: a.area, segment: PORTFOLIO_CUSTOMERS[customer]!, customer, period: "prior" as const, sales: prior[i]! },
    ]);
  });
  const coverage = AREAS.filter((a) => a.area !== null).map((a) => ({ area: a.area as string, activeProducts: a.products, suppliers: a.suppliers }));
  return { ...buildPortfolio(rows, coverage), from: "2026-01-01", to: DEMO_AS_OF, priorFrom: "2025-01-01", priorTo: "2025-10-08" };
}
