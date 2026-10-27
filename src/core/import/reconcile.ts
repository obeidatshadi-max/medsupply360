/**
 * Reconciliation summary: totals of what was actually loaded, for the accountant to tick against Alpha's own report
 * ("sales this month", "total unpaid", "stock value"). Computed from the rows that were accepted, in whole fils so no
 * float drift. A gap is stated as a gap ("no due date"), never folded into a zero.
 */
import { AGING_BUCKETS, agingBucket, daysBetween } from "../calc";
import type { RowRef } from "./specs";
import type { ImportKind } from "./specs";

export interface SummaryLine {
  label: string;
  value: string;
}

const fils = (v: unknown) => Math.round(Number(v) * 1000);
const jod = (f: number) => `${(f / 1000).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} JOD`;
const count = (n: number) => n.toLocaleString("en-US");

function range(dates: string[]): string {
  if (dates.length === 0) return "none";
  const sorted = [...dates].sort();
  return sorted[0] === sorted[sorted.length - 1] ? sorted[0] : `${sorted[0]} to ${sorted[sorted.length - 1]}`;
}

function tally(rows: RowRef[], key: (r: RowRef) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m].sort((a, b) => a[0].localeCompare(b[0]));
}

export function reconcile(kind: ImportKind, rows: RowRef[], snapshotDate: string | null): SummaryLine[] {
  const str = (r: RowRef, k: string) => (r.values[k] == null ? null : String(r.values[k]));
  const sum = (list: RowRef[], k: string) => list.reduce((s, r) => s + fils(r.values[k]), 0);
  const lines: SummaryLine[] = [];

  switch (kind) {
    case "products": {
      lines.push({ label: "Products loaded", value: count(rows.length) });
      for (const [line, n] of tally(rows, (r) => str(r, "line") ?? "?")) lines.push({ label: line, value: count(n) });
      lines.push({ label: "Expiry tracked", value: count(rows.filter((r) => r.values.tracksExpiry === true).length) });
      break;
    }
    case "customers": {
      lines.push({ label: "Customers loaded", value: count(rows.length) });
      for (const [seg, n] of tally(rows, (r) => str(r, "segment") ?? "Not classified")) lines.push({ label: seg, value: count(n) });
      lines.push({ label: "No payment terms", value: count(rows.filter((r) => r.values.paymentTermsDays == null).length) });
      break;
    }
    case "sales": {
      const sales = rows.filter((r) => r.values.docType !== "return");
      const returns = rows.filter((r) => r.values.docType === "return");
      const noCost = rows.filter((r) => r.values.productCost == null);
      lines.push({ label: "Lines loaded", value: `${count(rows.length)} (${count(sales.length)} sales, ${count(returns.length)} returns)` });
      // A credit note is not an invoice: counting it as one inflates the invoice count and the "no due date" line.
      lines.push({ label: "Invoices", value: count(new Set(sales.map((r) => str(r, "invoiceNo"))).size) });
      lines.push({ label: "Credit notes (returns)", value: count(new Set(returns.map((r) => str(r, "invoiceNo"))).size) });
      lines.push({ label: "Dates", value: range(rows.map((r) => String(r.values.invoiceDate))) });
      lines.push({ label: "Net sales, sales lines", value: jod(sum(sales, "netSales")) });
      lines.push({ label: "Net sales, returns", value: jod(sum(returns, "netSales")) });
      lines.push({ label: "Net sales after returns", value: jod(sum(rows, "netSales")) });
      lines.push({ label: "Product cost", value: jod(sum(rows.filter((r) => r.values.productCost != null), "productCost")) });
      lines.push({ label: "Lines without cost", value: count(noCost.length) });
      const dueByInvoice = new Map<string, boolean>();
      for (const r of sales) dueByInvoice.set(String(r.values.invoiceNo), (dueByInvoice.get(String(r.values.invoiceNo)) ?? false) || r.values.dueDate != null);
      lines.push({ label: "Invoices without a due date", value: count([...dueByInvoice.values()].filter((has) => !has).length) });
      break;
    }
    case "receipts": {
      const unapplied = rows.filter((r) => r.values.invoiceNo == null);
      lines.push({ label: "Allocation rows loaded", value: count(rows.length) });
      lines.push({ label: "Receipts", value: count(new Set(rows.map((r) => str(r, "receiptNo"))).size) });
      lines.push({ label: "Dates", value: range(rows.map((r) => String(r.values.receiptDate))) });
      lines.push({ label: "Cash received", value: jod(sum(rows, "allocatedAmount")) });
      lines.push({ label: "Of which not linked to an invoice", value: jod(sum(unapplied, "allocatedAmount")) });
      break;
    }
    case "open_invoices": {
      const asOf = snapshotDate ?? "";
      const dated = rows.filter((r) => r.values.dueDate != null);
      const undated = rows.filter((r) => r.values.dueDate == null);
      lines.push({ label: "Snapshot date", value: asOf || "none" });
      lines.push({ label: "Unpaid invoices", value: count(rows.length) });
      lines.push({ label: "Total outstanding", value: jod(sum(rows, "remainingAmount")) });
      if (asOf) {
        const buckets = new Map<string, number>(AGING_BUCKETS.map((b) => [b, 0]));
        for (const r of dated) {
          const b = agingBucket(daysBetween(String(r.values.dueDate), asOf));
          buckets.set(b, (buckets.get(b) ?? 0) + fils(r.values.remainingAmount));
        }
        for (const [b, f] of buckets) lines.push({ label: b === "Not due" ? "Not yet due" : `${b} days overdue`, value: jod(f) });
      }
      lines.push({ label: "No due date (age unknown)", value: `${count(undated.length)} invoices, ${jod(sum(undated, "remainingAmount"))}` });
      break;
    }
    case "stock_snapshot": {
      const owned = rows.filter((r) => r.values.owned !== false);
      const notOwned = rows.filter((r) => r.values.owned === false);
      const costed = owned.filter((r) => r.values.unitCost != null);
      const value = costed.reduce((s, r) => s + Math.round((Number(r.values.quantity) * Number(r.values.unitCost) * 1000)), 0);
      const asOf = snapshotDate ?? "";
      lines.push({ label: "Snapshot date", value: asOf || "none" });
      lines.push({ label: "Stock rows loaded", value: count(rows.length) });
      lines.push({ label: "Products", value: count(new Set(rows.map((r) => str(r, "productCode"))).size) });
      lines.push({ label: "Owned stock value (cost known)", value: jod(value) });
      lines.push({ label: "Owned rows without unit cost", value: count(owned.length - costed.length) });
      lines.push({ label: "Not owned (excluded from value)", value: `${count(notOwned.length)} rows` });
      if (asOf) lines.push({ label: "Rows past expiry at snapshot", value: count(rows.filter((r) => r.values.expiryDate != null && String(r.values.expiryDate) < asOf).length) });
      break;
    }
    case "stock_transactions": {
      lines.push({ label: "Transactions loaded", value: count(rows.length) });
      lines.push({ label: "Dates", value: range(rows.map((r) => String(r.values.txDate))) });
      for (const [t, n] of tally(rows, (r) => str(r, "txType") ?? "?")) lines.push({ label: t.replace("_", " "), value: count(n) });
      break;
    }
    case "tenders": {
      lines.push({ label: "Tenders in the file", value: count(rows.length) });
      lines.push({ label: "New tenders", value: count(rows.filter((r) => r.values._existingId == null).length) });
      lines.push({ label: "Already recorded (details updated)", value: count(rows.filter((r) => r.values._existingId != null).length) });
      for (const [a, n] of tally(rows, (r) => str(r, "authority") ?? "?")) lines.push({ label: a, value: count(n) });
      for (const [s, n] of tally(rows, (r) => str(r, "status") ?? "pipeline")) lines.push({ label: `Stage: ${s.replace("_", " ")}`, value: count(n) });
      lines.push({ label: "Estimated value", value: jod(sum(rows.filter((r) => r.values.estimatedValue != null), "estimatedValue")) });
      lines.push({ label: "Without a tender number", value: count(rows.filter((r) => r.values.tenderNo == null).length) });
      break;
    }
    case "sales_people": {
      lines.push({ label: "People in the file", value: count(rows.length) });
      lines.push({ label: "New", value: count(rows.filter((r) => r.values._existingId == null).length) });
      lines.push({ label: "Already recorded (updated)", value: count(rows.filter((r) => r.values._existingId != null).length) });
      lines.push({ label: "Monthly sales targets", value: jod(sum(rows.filter((r) => r.values.monthlySalesTarget != null), "monthlySalesTarget")) });
      lines.push({ label: "Without a monthly target", value: count(rows.filter((r) => r.values.monthlySalesTarget == null).length) });
      break;
    }
    case "tender_results": {
      const items = new Set(rows.map((r) => [str(r, "authority"), str(r, "tenderNo"), str(r, "lineRef")].join("\u0000")));
      const tenders = new Set(rows.map((r) => [str(r, "authority"), str(r, "tenderNo")].join("\u0000")));
      const priced = rows.filter((r) => r.values.unitPrice != null);
      lines.push({ label: "Bid rows loaded", value: count(rows.length) });
      lines.push({ label: "Tenders", value: count(tenders.size) });
      lines.push({ label: "Items asked for", value: count(items.size) });
      lines.push({ label: "Award dates", value: range(rows.map((r) => String(r.values.awardDate))) });
      for (const [a, n] of tally(rows, (r) => str(r, "authority") ?? "?")) lines.push({ label: `Bid rows, ${a}`, value: count(n) });
      lines.push({ label: "Our bids", value: count(rows.filter((r) => r.values.ourBid === true).length) });
      lines.push({ label: "Winning bids", value: count(rows.filter((r) => r.values.result === "won").length) });
      lines.push({ label: "Rows with a price", value: count(priced.length) });
      lines.push({ label: "Rows without a price (kept, price unknown)", value: count(rows.length - priced.length) });
      lines.push({ label: "Prices not in JOD (not compared)", value: count(priced.filter((r) => r.values.currency !== "JOD").length) });
      break;
    }
    case "installed_units": {
      lines.push({ label: "Units loaded", value: count(rows.length) });
      lines.push({ label: "Customers", value: count(new Set(rows.map((r) => str(r, "customerCode"))).size) });
      lines.push({ label: "Without install date", value: count(rows.filter((r) => r.values.installedOn == null).length) });
      lines.push({ label: "Without service status", value: count(rows.filter((r) => r.values.service == null).length) });
      break;
    }
  }
  return lines;
}
