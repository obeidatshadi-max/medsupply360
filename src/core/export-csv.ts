/**
 * "Export" in the top bar: the figures, tables and cards of the screen being read, as a CSV file for Excel, as in the
 * demo. It exports what the page shows, so the business-line filter and the top-bar search apply: a hidden row is not
 * exported. Pure CSV writing plus a small DOM reader, both tested.
 */
import { HIDDEN_ATTR } from "./page-search";

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

const quote = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** CSV text with a BOM (so Excel reads Arabic correctly) and Windows line breaks. */
export function toCsv(rows: readonly (readonly string[])[]): string {
  return "﻿" + rows.map((r) => r.map(quote).join(",")).join("\r\n") + "\r\n";
}

/** "Sales & accounts" -> "sales-accounts". */
export const fileSlug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "screen";

export const exportFileName = (name: string, today: string): string => `MedSupply360_${fileSlug(name)}_${today}.csv`;

const visible = (el: Element) => !el.closest(`[${HIDDEN_ATTR}]`);

/** The nearest heading before a table, so each block of the file says what it is. */
function titleOf(table: Element): string {
  const label = clean(table.closest("section")?.getAttribute("aria-label"));
  const heading = clean(table.closest("section")?.querySelector("h2, h3")?.textContent);
  return heading || label || "Table";
}

/** Every figure tile, table and card on the screen, as rows of cells with a title row before each block and a blank row between blocks. */
export function collectExport(root: ParentNode): string[][] {
  const out: string[][] = [];
  const block = (title: string, header: string[] | null, rows: string[][]) => {
    if (rows.length === 0) return;
    if (out.length > 0) out.push([]);
    out.push([title]);
    if (header && header.some(Boolean)) out.push(header);
    out.push(...rows);
  };

  const figures = Array.from(root.querySelectorAll("[data-figure]")).filter(visible).map((el) => {
    const p = Array.from(el.querySelectorAll("p")).map((x) => clean(x.textContent));
    return [p[0] ?? "", p[1] ?? "", p[2] ?? ""];
  });
  block("Figures", ["Figure", "Value", "Note"], figures);

  for (const table of Array.from(root.querySelectorAll("table"))) {
    const header = Array.from(table.querySelectorAll("thead th")).map((th) => clean(th.textContent));
    const rows = Array.from(table.querySelectorAll("tbody tr"))
      .filter(visible)
      .map((tr) => Array.from(tr.querySelectorAll("td, th")).map((td) => clean(td.textContent)));
    block(titleOf(table), header, rows);
  }

  const cards = Array.from(root.querySelectorAll("article")).filter((el) => visible(el) && !el.closest("table"));
  const texts = cards.map((el) => {
    const walker = (el.ownerDocument ?? document).createTreeWalker(el, 4 /* SHOW_TEXT */);
    const parts: string[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = clean(n.textContent);
      if (t !== "") parts.push(t);
    }
    return [parts.join(" · ")];
  });
  block("Cards", null, texts.filter((r) => r[0] !== ""));

  return out;
}
