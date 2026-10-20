/**
 * The promotional demo's "Support functions" screen. It judges each reading with the app's own rules
 * (src/core/support-indicators.ts), so a figure is on or off target in the demo exactly as in the app. The five
 * indicators and every figure are made up, and the targets are example management assumptions.
 */
import { STATUS_LABEL, indicatorStatus, sortIndicators, summarize, targetText, valueText, type Direction, type IndicatorStatus } from "@/core/support-indicators";
import { dayText } from "@/lib/format";

export interface DemoIndicator {
  department: string;
  name: string;
  unit: string;
  direction: Direction;
  target: number;
  actual: number | null;
  measuredOn: string | null;
  responsible: string;
  consequence: string;
}

export const DEMO_INDICATORS: DemoIndicator[] = [
  { department: "Logistics", name: "On-time deliveries", unit: "%", direction: "at_least", target: 95, actual: 88, measuredOn: "2026-10-05", responsible: "Operations manager", consequence: "Urgent freight: JOD 4.8K in Jan-Sep 2026" },
  { department: "Procurement", name: "Supplier deliveries on time", unit: "%", direction: "at_least", target: 90, actual: 81, measuredOn: "2026-10-05", responsible: "Procurement manager", consequence: "2 consumable backorders" },
  { department: "HR & development", name: "Critical-role vacancy days", unit: "days", direction: "at_most", target: 30, actual: 42, measuredOn: "2026-09-30", responsible: "HR manager", consequence: "Jordan service-engineer vacancy" },
  { department: "Customer support", name: "Cases solved within the agreed time", unit: "%", direction: "at_least", target: 95, actual: 84, measuredOn: "2026-10-06", responsible: "Service manager", consequence: "9 cases awaiting resolution" },
  { department: "Tender support", name: "Complete documents at review", unit: "%", direction: "at_least", target: 98, actual: 76, measuredOn: "2026-10-01", responsible: "Tender manager", consequence: "Technical dossier bottleneck" },
  { department: "Finance", name: "Invoices issued within 2 days of delivery", unit: "%", direction: "at_least", target: 95, actual: 96, measuredOn: "2026-10-06", responsible: "Finance manager", consequence: "Late invoices delay cash collection" },
  { department: "Logistics", name: "Stock count accuracy", unit: "%", direction: "at_least", target: 99, actual: null, measuredOn: null, responsible: "Warehouse supervisor", consequence: "Wrong counts hide stock that is about to expire" },
];

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const STYLE: Record<IndicatorStatus, string> = {
  met: "background:#e8f2ed;color:#233534",
  missed: "background:#f8eae5;color:#a3402a",
  no_reading: "background:#fff;border:1px solid var(--border);color:#657367",
};

const matches = (i: DemoIndicator, q: string) => [i.department, i.name, i.responsible, i.consequence].some((s) => s.toLowerCase().includes(q.toLowerCase()));

/** Rows for the demo's Export button on this screen. */
export const supportCsvRows = (query?: string): string[][] => [
  ["Department", "Indicator", "Actual", "Measured on", "Target", "Status", "Business consequence", "Responsible"],
  ...sortIndicators(DEMO_INDICATORS.filter((i) => !query || matches(i, query))).map((i) => [
    i.department,
    i.name,
    i.actual === null ? "" : valueText(i.actual, i.unit),
    i.measuredOn ?? "",
    targetText(i.direction, i.target, i.unit),
    STATUS_LABEL[indicatorStatus(i.direction, i.target, i.actual)],
    i.consequence,
    i.responsible,
  ]),
];

export function supportHtml({ query }: { query?: string } = {}): string {
  const rows = sortIndicators(DEMO_INDICATORS.filter((i) => !query || matches(i, query)));
  const t = summarize(DEMO_INDICATORS);
  const tiles = (
    [
      ["Indicators followed", String(t.total), `${t.departments} departments`],
      ["Off target", String(t.missed), "Latest reading misses the target"],
      ["On target", String(t.met), "Latest reading meets the target"],
      ["No reading yet", String(t.noReading), "Defined, but nobody has recorded a figure"],
    ] as const
  )
    .map(([l, v, n]) => `<div class="stat"><div class="label">${l}</div><div class="value">${v}</div><div class="note">${n}</div></div>`)
    .join("");

  const body = rows.length
    ? rows
        .map((i) => {
          const status = indicatorStatus(i.direction, i.target, i.actual);
          return (
            `<tr><td data-label="Department"><b>${esc(i.department)}</b></td>` +
            `<td data-label="Indicator">${esc(i.name)}<span class="cellsub">Responsible: ${esc(i.responsible)}</span></td>` +
            `<td data-label="Actual">${i.actual === null ? "—" : esc(valueText(i.actual, i.unit))}${i.measuredOn ? `<span class="cellsub">Measured ${esc(dayText(i.measuredOn))}</span>` : ""}</td>` +
            `<td data-label="Target">${esc(targetText(i.direction, i.target, i.unit))}</td>` +
            `<td data-label="Status"><span style="padding:2px 8px;border-radius:5px;font-size:12px;${STYLE[status]}">${STATUS_LABEL[status]}</span></td>` +
            `<td data-label="Business consequence">${esc(i.consequence)}</td>` +
            `<td data-label="Reading"><button data-support-reading="${esc(i.name)}">Record a reading</button></td></tr>`
          );
        })
        .join("")
    : `<tr><td colspan="7" class="empty">No matching indicator. Change the search.</td></tr>`;

  return (
    `<div class="info">Support indicators cover the whole company, so the business-line filter does not split the shared work of a department. The owner sets each target and who answers for it, and a person records each reading. All figures and targets here are made up.</div>` +
    `<div class="stats">${tiles}</div>` +
    `<section class="panel"><div class="panelhead"><div><h2>Support function effectiveness</h2><p class="sub">Off-target indicators come first, the biggest miss at the top.</p></div></div>` +
    `<div class="tablewrap"><table><thead><tr><th>Department</th><th>Indicator</th><th>Actual</th><th>Target</th><th>Status</th><th>Business consequence</th><th></th></tr></thead><tbody>${body}</tbody></table></div></section>` +
    `<p class="mini">In the live app the owner can add an indicator, change a target, or record a reading after typing their name. The Update history lists who recorded what, and when.</p>`
  );
}
