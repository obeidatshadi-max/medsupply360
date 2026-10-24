/**
 * The item lines of a live tender: what the authority asked for (item, quantity), what the authority estimated per unit,
 * and what we offered per unit. Totals are worked out here from the lines, so the screens, the tender's own bid and
 * estimate values, and the tests all use one rule. Money is JOD, rounded to the fils (3 decimals) line by line.
 */
import { parseJod } from "./jod";

export const MAX_ITEMS = 200;
export const ITEM_NAME_MAX = 300;
export const UNIT_MAX = 30;

/** One line as a form posts it: every field is text. */
export interface ItemForm {
  itemName: string;
  quantity: string;
  unit: string;
  estimatedUnitPrice: string;
  ourUnitPrice: string;
}

export interface TenderItem {
  itemName: string;
  quantity: number;
  unit: string | null;
  estimatedUnitPrice: number | null;
  ourUnitPrice: number | null;
}

const round3 = (v: number) => Math.round((v + Number.EPSILON) * 1000) / 1000;

export const lineTotal = (quantity: number, unitPrice: number | null): number | null => (unitPrice === null ? null : round3(quantity * unitPrice));

/** A quantity: a positive number with at most 3 decimals; commas are thousands separators. */
export function parseQuantity(input: string | null | undefined): number | "invalid" {
  const text = (input ?? "").trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,3})?$/.test(text)) return "invalid";
  const n = Number(text);
  return n > 0 ? n : "invalid";
}

/** Turns posted rows into items. Rows left completely empty are dropped; a half-filled row is an error that names its line. */
export function cleanItems(rows: ItemForm[]): { ok: true; items: TenderItem[] } | { ok: false; error: string } {
  const filled = rows.filter((r) => Object.values(r).some((v) => v.trim() !== ""));
  if (filled.length > MAX_ITEMS) return { ok: false, error: `A tender can hold at most ${MAX_ITEMS} item lines.` };
  const items: TenderItem[] = [];
  for (const [i, r] of filled.entries()) {
    const n = i + 1;
    const itemName = r.itemName.trim();
    if (itemName === "") return { ok: false, error: `Line ${n}: enter the item name.` };
    if (itemName.length > ITEM_NAME_MAX) return { ok: false, error: `Line ${n}: the item name is longer than ${ITEM_NAME_MAX} characters.` };
    const quantity = parseQuantity(r.quantity);
    if (quantity === "invalid") return { ok: false, error: `Line ${n}: the quantity must be a number above zero, for example 12 or 2,500.` };
    const unit = r.unit.trim();
    if (unit.length > UNIT_MAX) return { ok: false, error: `Line ${n}: the unit is longer than ${UNIT_MAX} characters.` };
    const est = parseJod(r.estimatedUnitPrice);
    if (est === "invalid") return { ok: false, error: `Line ${n}: the estimated unit price must be a number in JOD, for example 4.250.` };
    const ours = parseJod(r.ourUnitPrice);
    if (ours === "invalid") return { ok: false, error: `Line ${n}: our unit price must be a number in JOD, for example 4.250.` };
    items.push({ itemName, quantity, unit: unit === "" ? null : unit, estimatedUnitPrice: est, ourUnitPrice: ours });
  }
  return { ok: true, items };
}

export interface ItemTotals {
  count: number;
  /** Sum of quantity x authority estimate, or null unless EVERY line has an estimate (a partial sum would understate). */
  estimated: number | null;
  /** Sum of quantity x our price, or null unless EVERY line has our price. */
  bid: number | null;
  /** Lines still without our price, so the screen can say the bid is incomplete. */
  unpriced: number;
}

export function itemTotals(items: readonly TenderItem[]): ItemTotals {
  const sum = (pick: (i: TenderItem) => number | null): number | null => {
    if (items.length === 0) return null;
    let total = 0;
    for (const i of items) {
      const t = lineTotal(i.quantity, pick(i));
      if (t === null) return null;
      total += t;
    }
    return round3(total);
  };
  return {
    count: items.length,
    estimated: sum((i) => i.estimatedUnitPrice),
    bid: sum((i) => i.ourUnitPrice),
    unpriced: items.filter((i) => i.ourUnitPrice === null).length,
  };
}
