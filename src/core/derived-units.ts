/**
 * Machines taken from the ERP sales that were already imported, so the equipment list does not have to be typed again.
 * Pure.
 *
 * Every piece of equipment sold to a customer is a machine at that customer (devices are added by hand, see lib/installed-base). The first sale date stands in for the
 * install date (it is when the machine was sold, not proof of when it was fitted). Warranty and service status are not
 * in the sales file, so they stay unrecorded until the owner adds them in Data, Manual entry. A machine the owner has
 * described there replaces its derived twin.
 */
import type { UnitInput } from "./installed-base";

/** What the sales file says about one product sold to one customer, summed over the whole history. */
export interface SoldGroup {
  customerCode: string;
  customerName: string;
  productCode: string;
  productName: string;
  line: "Equipment" | "Devices";
  /** Quantity sold less quantity returned. */
  netQuantity: number;
  /** Date of the earliest sale line with a positive quantity. */
  firstSale: string | null;
}

/** A single group can stand for at most this many machines; a bigger quantity is more likely a stock of spare parts than machines. */
export const MAX_MACHINES_PER_GROUP = 50;

export const derivedCode = (customerCode: string, productCode: string, n: number): string => `ERP-${customerCode}-${productCode}-${n}`;
export const isDerivedCode = (code: string): boolean => code.startsWith("ERP-");

export function deriveUnits(groups: readonly SoldGroup[]): UnitInput[] {
  const out: UnitInput[] = [];
  for (const g of groups) {
    const count = Math.min(MAX_MACHINES_PER_GROUP, Math.max(0, Math.floor(g.netQuantity)));
    for (let n = 1; n <= count; n++) {
      out.push({
        code: derivedCode(g.customerCode, g.productCode, n),
        name: g.productName,
        line: g.line,
        productCode: g.productCode,
        source: "erp",
        customerCode: g.customerCode,
        customerName: g.customerName,
        installedOn: g.firstSale,
        warrantyEnd: null,
        service: null,
        expectedMonthly: null,
      });
    }
  }
  return out;
}

/**
 * Machines the owner described by hand replace the ones derived from sales. A described machine takes the place of the
 * derived one with the same code; failing that, of one for the same customer and product; a described machine with
 * no derived twin (not sold through the ERP, or no product) is simply added.
 */
export function mergeUnits(derived: readonly UnitInput[], described: readonly UnitInput[]): UnitInput[] {
  const left = [...derived];
  const take = (match: (u: UnitInput) => boolean) => {
    const i = left.findIndex(match);
    if (i >= 0) left.splice(i, 1);
  };
  for (const m of described) {
    const sameCode = left.findIndex((d) => d.code === m.code) >= 0;
    if (sameCode) take((d) => d.code === m.code);
    else if (m.productCode) take((d) => d.customerCode === m.customerCode && d.productCode === m.productCode);
  }
  return [...left, ...described.map((m) => ({ ...m, source: "manual" as const }))].sort((a, b) => a.customerName.localeCompare(b.customerName) || a.name.localeCompare(b.name) || a.code.localeCompare(b.code));
}

/** The span of months before the purchase window whose consumables set a customer's own earlier norm. */
export const HISTORY_MONTHS = 9;
/** A customer must have bought in at least this many of those months for the norm to mean anything. */
export const HISTORY_MIN_MONTHS = 3;

export interface EarlierPurchases {
  customerCode: string;
  /** Consumables sales (after returns) over the span. */
  sales: number;
  /** In how many distinct months of the span the customer bought. */
  monthsWithSales: number;
}

/**
 * What each customer usually bought per month before the recent window: the average over the span, only for customers
 * who bought often enough for that to be a norm. Everyone else gets no estimate rather than a guess.
 */
export function earlierMonthlyNorm(rows: readonly EarlierPurchases[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    if (r.monthsWithSales >= HISTORY_MIN_MONTHS && r.sales > 0) out.set(r.customerCode, r.sales / HISTORY_MONTHS);
  }
  return out;
}
