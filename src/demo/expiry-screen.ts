/**
 * The promotional demo's "Expiry alerts" screen. It builds the list with the app's own rules (src/core/expiry-alerts.ts)
 * from the demo's made-up machines, so it shows what the live page shows. Nothing is saved anywhere.
 */
import { BUCKETS, BUCKET_LABEL, KIND_LABEL, buildExpiryList, daysText, summarizeExpiry } from "@/core/expiry-alerts";
import type { UnitInput } from "@/core/installed-base";
import { DEMO_AS_OF, units } from "./dataset";

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "30 Nov 2026" to "2026-11-30"; null when the text is not a date. */
export function isoFromDemoDate(text: string): string | null {
  const m = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/.exec(text.trim());
  if (!m) return null;
  const month = MONTHS.indexOf(m[2]!.toLowerCase());
  return month < 0 ? null : `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
}

const dayLabel = (iso: string) => {
  const [y, mo, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(mo) - 1]!.replace(/^./, (c) => c.toUpperCase())} ${y}`;
};

/** The demo machines as the app's own unit records. The customer's name stands in for its code. */
export function demoExpiryUnits(): UnitInput[] {
  return units.map((u) => ({
    code: u.id,
    name: u.name,
    customerCode: u.account,
    customerName: u.account,
    installedOn: isoFromDemoDate(u.installed),
    warrantyEnd: isoFromDemoDate(u.warranty),
    service: u.service,
    expectedMonthly: u.expected,
    contractEnd: u.contractEnd ?? null,
    contactName: u.contactName ?? null,
    contactPhone: u.contactPhone ?? null,
  }));
}

export function demoExpiryItems() {
  return buildExpiryList(demoExpiryUnits(), DEMO_AS_OF);
}

/** `kind` filters like the live page's chips: "contract", "warranty" or empty for all. */
export function expiryAlertsHtml({ kind = "" }: { kind?: string } = {}): string {
  const all = demoExpiryItems();
  const summary = summarizeExpiry(all, demoExpiryUnits());
  const items = kind === "contract" || kind === "warranty" ? all.filter((i) => i.kind === kind) : all;
  const tiles = BUCKETS.map(
    (b) => `<div class="stat"><div class="label">${esc(BUCKET_LABEL[b])}</div><div class="value">${summary.byBucket[b]}</div></div>`,
  ).join("");
  const chips = [
    ["", `All (${summary.total})`],
    ["contract", `Service contracts (${summary.byKind.contract})`],
    ["warranty", `Warranties (${summary.byKind.warranty})`],
  ]
    .map(([k, label]) => `<button type="button" class="chip${kind === k ? " active" : ""}" data-expiry-kind="${k}">${esc(label!)}</button>`)
    .join(" ");
  const sections = BUCKETS.map((b) => {
    const rows = items.filter((i) => i.bucket === b);
    if (rows.length === 0) return "";
    const body = rows
      .map(
        (r) =>
          `<tr><td data-label="Machine">${esc(r.unitName)}</td><td data-label="Customer">${esc(r.customerName)}</td><td data-label="What ends">${esc(KIND_LABEL[r.kind])}</td><td data-label="Date">${esc(dayLabel(r.date))}</td><td data-label="When">${esc(daysText(r.days))}</td><td data-label="Contact to call">${r.contact ? esc(r.contact) : "Not recorded"}</td></tr>`,
      )
      .join("");
    return `<section class="panel"><div class="panelhead"><div><h2>${esc(BUCKET_LABEL[b])} (${rows.length})</h2></div></div><div class="tablewrap"><table><thead><tr><th>Machine</th><th>Customer</th><th>What ends</th><th>Date</th><th>When</th><th>Contact to call</th></tr></thead><tbody>${body}</tbody></table></div></section>`;
  }).join("");
  return (
    `<div class="info">Service contracts and warranties that end within 90 days, or ended in the last 30. Each one is a call to make: renew the contract, sell one, or tell the customer the warranty is ending. Only dates someone recorded are used.</div>` +
    `<div class="stats">${tiles}</div><p style="margin:12px 0">${chips}</p>` +
    (sections || `<div class="info">Nothing ends within the next 90 days, and nothing ended in the last 30.</div>`) +
    `<p class="mini">${summary.machinesWithoutDates} machine${summary.machinesWithoutDates === 1 ? " has" : "s have"} no contract or warranty end date, so nothing can be said about ${summary.machinesWithoutDates === 1 ? "it" : "them"}. A contract end date also sets the machine's service status.</p>`
  );
}
