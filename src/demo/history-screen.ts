/**
 * The promotional demo's "Update history" tab: who entered or changed data, and when. Every row is derived from the same
 * made-up tenders, guarantees and invoices as the Tenders screen, and the sentences come from the app's own wording
 * (src/core/data-history.ts), so the demo and the live list read the same. The names are invented; in the live app each
 * person types theirs on the form and the server sets the date and time.
 */
import { describeAction, type DataAction, type HistoryArea, areaOf } from "@/core/data-history";
import { dayText, jod } from "@/lib/format";
import { DEMO_AS_OF } from "./dataset";
import { DEMO_GUARANTEES, DEMO_INVOICES, DEMO_STAFF, DEMO_TENDERS } from "./tender-demo";

export interface DemoHistoryRow {
  /** Local Jordan time, "YYYY-MM-DD HH:MM". */
  at: string;
  by: string;
  account: string;
  area: HistoryArea;
  text: string;
  tenderId: string | null;
  tenderTitle: string | null;
}

const OWNER = { name: "Sami Nasser", account: "Owner" };

/** A steady working-hours time for a sample entry, so the same row always shows the same time. */
function clock(date: string, key: string): string {
  let h = 0;
  for (const c of `${date}${key}`) h = (h * 31 + c.charCodeAt(0)) % 997;
  return `${date} ${String(8 + (h % 9)).padStart(2, "0")}:${String(h % 60).padStart(2, "0")}`;
}

export function demoHistory(limit = 25): DemoHistoryRow[] {
  const rows: DemoHistoryRow[] = [];
  const add = (date: string, key: string, by: string, account: string, action: DataAction, details: Record<string, unknown>, tenderId: string | null) => {
    if (date > DEMO_AS_OF) return;
    const t = tenderId ? DEMO_TENDERS.find((x) => x.id === tenderId) : null;
    rows.push({ at: clock(date, key), by, account, area: areaOf(action), text: describeAction(action, details), tenderId: t?.id ?? null, tenderTitle: t?.title ?? null });
  };

  for (const t of DEMO_TENDERS) {
    t.history.forEach((h, i) => {
      const prev = i === 0 ? null : t.history[i - 1]!.to;
      const account = DEMO_STAFF[h.by] ?? "Tender Department";
      if (prev === null) add(h.on, `${t.id}-${i}`, h.by, account, "tender.created", {}, t.id);
      else add(h.on, `${t.id}-${i}`, h.by, account, "tender.moved", { from: prev, to: h.to }, t.id);
    });
  }
  for (const g of DEMO_GUARANTEES) {
    const who = g.kind === "bid" ? "Omar Saleh" : "Rana Khoury";
    if (g.issuedOn) add(g.issuedOn, g.reference, who, DEMO_STAFF[who]!, "tender.guarantee_added", { kind: g.kind }, g.tenderId);
    if (g.returnedOn) add(g.returnedOn, `${g.reference}-r`, "Rana Khoury", "Finance Department", "tender.guarantee_updated", {}, g.tenderId);
  }
  for (const i of DEMO_INVOICES) {
    add(i.invoiceDate, i.invoiceNo, "Rana Khoury", "Finance Department", "tender.invoice_added", {}, i.tenderId);
    if (i.lastCollectedOn) add(i.lastCollectedOn, `${i.invoiceNo}-p`, "Rana Khoury", "Finance Department", "tender.payment_recorded", { collected: jod(i.collected) }, i.tenderId);
  }
  add("2026-10-06", "sup-1", OWNER.name, OWNER.account, "support.reading_recorded", { name: "Cases solved within the agreed time", reading: "84%" }, null);
  add("2026-10-05", "sup-2", OWNER.name, OWNER.account, "support.reading_recorded", { name: "On-time deliveries", reading: "88%" }, null);
  add("2026-09-24", "sup-3", OWNER.name, OWNER.account, "support.indicator_added", { name: "Stock count accuracy" }, null);
  add("2026-09-18", "profile-1", OWNER.name, OWNER.account, "profile.updated", {}, null);
  add("2026-10-05", "imp-sales", OWNER.name, OWNER.account, "import.run", { kind: "sales", fileName: "sales-sep-2026.csv", rowsAccepted: 412 }, null);
  add("2026-10-05", "imp-receipts", OWNER.name, OWNER.account, "import.run", { kind: "receipts", fileName: "receipts-sep-2026.csv", rowsAccepted: 138 }, null);
  add("2026-10-01", "imp-stock", OWNER.name, OWNER.account, "import.run", { kind: "stock_snapshot", fileName: "stock-2026-09-30.csv", rowsAccepted: 960 }, null);

  return rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.text.localeCompare(b.text))).slice(0, limit);
}

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const matches = (r: DemoHistoryRow, q: string) => [r.by, r.account, r.area, r.text, r.tenderTitle ?? ""].some((s) => s.toLowerCase().includes(q.toLowerCase()));

export function historyHtml({ query }: { query?: string } = {}): string {
  const rows = demoHistory().filter((r) => !query || matches(r, query));
  const body = rows.length
    ? rows
        .map(
          (r) =>
            `<tr><td data-label="When (Jordan time)">${esc(dayText(r.at.slice(0, 10)))}<span class="cellsub">${esc(r.at.slice(11))}</span></td>` +
            `<td data-label="Who"><b>${esc(r.by)}</b><span class="cellsub">Account: ${esc(r.account)}</span></td>` +
            `<td data-label="Area">${esc(r.area)}</td>` +
            `<td data-label="What">${esc(r.text)}${r.tenderId ? `<span class="cellsub"><button class="linkbtn" data-tender="${esc(r.tenderId)}">${esc(r.tenderTitle)}</button></span>` : ""}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="4" class="empty">No matching entry. Change the search.</td></tr>`;
  return (
    `<div class="info">Made-up people and entries. In the live app each person types their own name on the form and the date and time are set automatically, so a shared department sign-in still shows who entered every figure. Only the owner and administrators read this list.</div>` +
    `<section class="panel"><div class="panelhead"><div><h2>Who changed what, and when</h2><p class="sub">${rows.length} newest change${rows.length === 1 ? "" : "s"} · imports and tender updates</p></div></div>` +
    `<div class="tablewrap"><table><thead><tr><th>When (Jordan time)</th><th>Who</th><th>Area</th><th>What</th></tr></thead><tbody>${body}</tbody></table></div></section>`
  );
}

/** Rows for the demo's Export button on the Update history tab. */
export const historyCsvRows = (query?: string): string[][] => [
  ["When (Jordan time)", "Who", "Account", "Area", "What", "Tender"],
  ...demoHistory().filter((r) => !query || matches(r, query)).map((r) => [r.at, r.by, r.account, r.area, r.text, r.tenderTitle ?? ""]),
];
