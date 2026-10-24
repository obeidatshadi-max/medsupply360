/**
 * A tender that has been decided (won or lost) already holds most of what the Price history import asks for: the
 * authority, tender number, title, award date, who we are and whether we won. This builds a results file with those
 * cells filled in, so the tender department only types the items and prices. Pure.
 */
import { headingOf } from "./import/template";
import { SPECS } from "./import/specs";
import { type AuthorityCode, type TenderStatus } from "./tender-flow";
import type { TenderItem } from "./tender-items";

/** Statuses from which a tender's award result is known: it was won (and may have moved on) or lost. */
export const RESULT_STATUSES: readonly TenderStatus[] = ["won", "contracted", "delivered", "collected", "lost"];
export const hasAwardResult = (s: TenderStatus): boolean => RESULT_STATUSES.includes(s);

export interface PrefillTender {
  authority: AuthorityCode;
  tenderNo: string | null;
  title: string;
  status: TenderStatus;
  /** YYYY-MM-DD of the decision (when it entered Won or Lost), if known. */
  awardDate: string | null;
  winnerName: string | null;
}

/**
 * Spreadsheet programs run a cell that starts with = + - @ (or a tab / carriage return) as a formula. Titles and company
 * names are typed by people, so such a cell gets a leading apostrophe; dates, codes and numbers are never changed.
 */
export const defuse = (v: string): string => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

const quote = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/**
 * Headings, then our bid, then (for a lost tender whose winner is known) the winner's bid. With item lines on the tender
 * there is one row per item and bidder: the item, quantity, unit and our price are filled from the lines, and the winner's
 * rows carry the item and quantity but no price (that comes from the award notice). Without item lines the item and
 * price cells are left empty to be typed.
 */
export function prefillRows(t: PrefillTender, ourCompany: string, items: readonly TenderItem[] = []): string[][] {
  const keys = SPECS.tender_results.fields.map((f) => f.key);
  const row = (v: Record<string, string>) => keys.map((k) => v[k] ?? "");
  const lost = t.status === "lost";
  const common = { authority: t.authority, tenderNo: defuse(t.tenderNo ?? ""), tenderTitle: defuse(t.title), awardDate: t.awardDate ?? "", currency: "JOD" };
  const head = keys.map((k) => headingOf("tender_results", k));
  const itemCells = (i: TenderItem | undefined, withPrice: boolean): Record<string, string> =>
    i ? { itemName: defuse(i.itemName), quantity: String(i.quantity), unit: defuse(i.unit ?? ""), unitPrice: withPrice && i.ourUnitPrice !== null ? i.ourUnitPrice.toFixed(3) : "" } : {};
  const lines: (TenderItem | undefined)[] = items.length ? [...items] : [undefined];
  const rows = [head, ...lines.map((i) => row({ ...common, ...itemCells(i, true), bidder: defuse(ourCompany), ourBid: "Yes", result: lost ? "lost" : "won" }))];
  if (lost && t.winnerName) for (const i of lines) rows.push(row({ ...common, ...itemCells(i, false), bidder: defuse(t.winnerName), ourBid: "No", result: "won" }));
  return rows;
}

/** CSV text with a BOM so Excel reads Arabic correctly. */
export const rowsToCsv = (rows: string[][]): string => "﻿" + rows.map((r) => r.map(quote).join(",")).join("\r\n") + "\r\n";

export const prefillFileName = (t: Pick<PrefillTender, "authority" | "tenderNo">): string =>
  `tender-results-${t.authority}-${(t.tenderNo ?? "no-number").replace(/[^A-Za-z0-9._-]+/g, "_")}.csv`;

