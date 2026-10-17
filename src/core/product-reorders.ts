/** Customer/product baseline for repeat consumables. These are estimates, never AI probabilities. */
import { daysBetween, isIsoDate, roundJod } from "./calc";
import { MIN_ORDERS, repurchaseForecast, type RepurchaseForecast } from "./predictions";

export interface ProductOrder {
  customerCode: string;
  customerName: string;
  productCode: string;
  productName: string;
  segment: string | null;
  category: string;
  unit: string | null;
  date: string;
  quantity: number;
  value: number;
  /** Date this version became available, if known. Backtests must not learn from later imports. */
  availableOn?: string;
}

export interface ProductReorder {
  customerCode: string;
  customerName: string;
  productCode: string;
  productName: string;
  unit: string | null;
  forecast: RepurchaseForecast;
  typicalQuantity: number;
  averageOrder: number;
}

export const productOrderKey = (r: Pick<ProductOrder, "customerCode" | "productCode">) => JSON.stringify([r.customerCode, r.productCode]);
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

export function buildProductReorders(rows: ProductOrder[], asOf: string) {
  if (!isIsoDate(asOf)) throw new RangeError("asOf must be YYYY-MM-DD");
  const groups = new Map<string, ProductOrder[]>();
  const excluded = { tender: 0, unclassified: 0, nonConsumable: 0, invalid: 0 };
  const orderDates: string[] = [];
  for (const r of rows) {
    if (!isIsoDate(r.date) || !Number.isFinite(r.quantity) || !Number.isFinite(r.value)) { excluded.invalid++; continue; }
    if (r.date > asOf || (r.availableOn && r.availableOn > asOf) || r.quantity <= 0 || r.value <= 0) continue;
    if (r.segment === "Tender") { excluded.tender++; continue; }
    if (r.segment !== "Private") { excluded.unclassified++; continue; }
    if (r.category !== "Consumables") { excluded.nonConsumable++; continue; }
    orderDates.push(r.date);
    const key = productOrderKey(r);
    const group = groups.get(key) ?? [];
    group.push(r);
    groups.set(key, group);
  }
  const items: ProductReorder[] = [];
  let insufficientHistory = 0;
  for (const group of groups.values()) {
    const forecast = repurchaseForecast(group.map((r) => r.date), asOf);
    if (forecast === "Not enough data") { insufficientHistory++; continue; }
    // Aggregate multiple invoice lines and invoices on the same day before estimating an order quantity/value.
    const daily = new Map<string, { quantity: number; value: number }>();
    for (const r of group) {
      const d = daily.get(r.date) ?? { quantity: 0, value: 0 };
      d.quantity += r.quantity;
      d.value += r.value;
      daily.set(r.date, d);
    }
    const recent = [...daily].filter(([date]) => daysBetween(date, asOf) <= 365).map(([, d]) => d);
    const metadata = [...group].sort((a, b) => b.date.localeCompare(a.date))[0]!;
    items.push({
      customerCode: metadata.customerCode, customerName: metadata.customerName,
      productCode: metadata.productCode, productName: metadata.productName, unit: metadata.unit,
      forecast,
      typicalQuantity: Math.round(median([...daily.values()].map((r) => r.quantity)) * 1000) / 1000,
      averageOrder: recent.length ? roundJod(recent.reduce((s, r) => s + r.value, 0) / recent.length) : 0,
    });
  }
  const rank = { Lapsed: 0, Overdue: 1, "Due soon": 2, "On cycle": 3 };
  items.sort((a, b) => rank[a.forecast.level] - rank[b.forecast.level] || b.averageOrder - a.averageOrder || productOrderKey(a).localeCompare(productOrderKey(b)));
  orderDates.sort();
  return { asOf, model: "median-cycle-v1" as const, items, eligiblePairs: items.length, insufficientHistory,
    minimumOrderDays: MIN_ORDERS, excluded, firstOrder: orderDates[0] ?? null, lastOrder: orderDates.at(-1) ?? null };
}

/** Rolling next-window benchmark. Only fully observed windows; no future orders in training. */
export function evaluateProductReorders(rows: ProductOrder[], cutoffs: string[], observedThrough: string, horizonDays = 30) {
  if (!isIsoDate(observedThrough) || !Number.isInteger(horizonDays) || horizonDays < 1) throw new RangeError("Invalid evaluation window");
  const scores: { cutoff: string; evaluated: number; predicted: number; actual: number; hits: number; timingErrors: number[] }[] = [];
  for (const cutoff of [...new Set(cutoffs)].sort()) {
    if (!isIsoDate(cutoff)) throw new RangeError("Invalid cutoff");
    if (daysBetween(cutoff, observedThrough) < horizonDays) continue;
    const forecasts = buildProductReorders(rows, cutoff).items;
    const outcomes = new Map<string, string>();
    for (const r of rows) {
      const delta = daysBetween(cutoff, r.date);
      if (r.segment !== "Private" || r.category !== "Consumables" || r.quantity <= 0 || r.value <= 0 || delta <= 0 || delta > horizonDays) continue;
      const key = productOrderKey(r);
      if (!outcomes.has(key) || r.date < outcomes.get(key)!) outcomes.set(key, r.date);
    }
    let predicted = 0, actual = 0, hits = 0;
    const timingErrors: number[] = [];
    for (const r of forecasts) {
      const next = outcomes.get(productOrderKey(r));
      const positive = r.forecast.daysToNext > 0 && r.forecast.daysToNext <= horizonDays;
      if (positive) predicted++;
      if (next) actual++;
      if (positive && next) hits++;
      if (next) timingErrors.push(Math.abs(daysBetween(r.forecast.expectedNext, next)));
    }
    scores.push({ cutoff, evaluated: forecasts.length, predicted, actual, hits, timingErrors });
  }
  const evaluated = scores.reduce((s, r) => s + r.evaluated, 0);
  const predicted = scores.reduce((s, r) => s + r.predicted, 0);
  const actual = scores.reduce((s, r) => s + r.actual, 0);
  const hits = scores.reduce((s, r) => s + r.hits, 0);
  const errors = scores.flatMap((r) => r.timingErrors);
  return { model: "median-cycle-v1", horizonDays, observedThrough, windows: scores.length, evaluated, predicted, actual, hits,
    precision: predicted ? hits / predicted : null, recall: actual ? hits / actual : null,
    timingMaeDays: errors.length ? errors.reduce((s, e) => s + e, 0) / errors.length : null,
    timingCases: errors.length, cutoffs: scores.map((r) => ({ cutoff: r.cutoff, evaluated: r.evaluated, predicted: r.predicted, actual: r.actual, hits: r.hits })),
    availability: rows.length > 0 && rows.every((r) => r.availableOn) ? "import-date-aware" : "retrospective: import availability not fully supplied",
    note: "Observed-through must cover complete exports. Current row versions do not reconstruct overwritten history. Timing error covers observed repeat orders only; use precision and recall alongside it." };
}
