/**
 * The promotional demo's "Data channels" screens: the hub with its three channel cards, and the sample preview of the
 * Manual channel. The cards use the app's own channel rules (src/core/channels.ts) and the spreadsheet reader runs the
 * app's own recognition (src/core/import/workbook.ts) on a made-up workbook, so the demo shows what the live upload does.
 * Nothing here is saved anywhere; the people and figures are invented.
 */
import { CHANNELS, CHANNEL_INFO, channelOfKind, channelState, lastUpdateText, type Channel, type ChannelStatus } from "@/core/channels";
import { SPECS } from "@/core/import/specs";
import { readWorkbook, type SheetGrid } from "@/core/import/workbook";
import { isClosed } from "@/core/tender-flow";
import { DEMO_AS_OF, units } from "./dataset";
import { DEMO_SALES_FORCE } from "./sales-force-demo";
import { DEMO_TENDERS } from "./tender-demo";

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The demo's own clock: noon on its snapshot date, so "days ago" never drifts with the real calendar. */
const DEMO_NOW = new Date(`${DEMO_AS_OF}T12:00:00Z`);

/** The ERP channel has gone a little stale on purpose, so the demo shows what "Needs an update" looks like. */
export function demoChannelStatus(): Record<Channel, ChannelStatus> {
  const open = DEMO_TENDERS.filter((t) => !isClosed(t.status)).length;
  const unitsCount = units.length;
  const people = DEMO_SALES_FORCE.length;
  return {
    erp: {
      channel: "erp",
      lastUpdate: "2026-09-28T09:00:00Z",
      by: "Sami Nasser",
      facts: ["6 of 7 file types loaded"],
      missing: [SPECS.stock_transactions.title],
    },
    tender: {
      channel: "tender",
      lastUpdate: "2026-10-07T10:30:00Z",
      by: "Lina Haddad",
      facts: [`${plural(DEMO_TENDERS.length, "tender")}, ${open} still open`],
      missing: [],
    },
    manual: {
      channel: "manual",
      lastUpdate: "2026-09-20T08:15:00Z",
      by: "Sami Nasser",
      facts: [plural(unitsCount, "installed unit"), plural(people, "sales person", "sales people")],
      missing: [],
    },
  };
}

const STATE_LABEL = { never: "Not started", fresh: "Up to date", stale: "Needs an update" } as const;
const STATE_STYLE = { never: "background:#f8eae5;color:#a3402a", fresh: "background:#e8f2ed;color:#2c6b52", stale: "background:#fff;border:1px solid var(--border);color:#8a6a1f" } as const;

/** `erpName` is the customer's own accounting system, e.g. "Alpha ERP". */
export function channelsHtml({ erpName = "Alpha ERP" }: { erpName?: string } = {}): string {
  const status = demoChannelStatus();
  const cards = CHANNELS.map((c) => {
    const info = CHANNEL_INFO[c];
    const s = status[c];
    const state = channelState(s, DEMO_NOW);
    const summary = c === "erp" ? info.summary.replace("Alpha ERP", erpName) : info.summary;
    return (
      `<article class="panel" aria-label="${esc(info.title)}" style="margin:0;display:flex;flex-direction:column">` +
      `<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><h2 style="margin:0">${esc(info.title)}</h2>` +
      `<span style="flex:none;padding:2px 8px;border-radius:5px;font-size:11px;${STATE_STYLE[state]}">${STATE_LABEL[state]}</span></div>` +
      `<p class="sub">${esc(summary)}</p>` +
      `<p style="margin:12px 0 2px">${esc(lastUpdateText(s, DEMO_NOW))}</p><p class="mini">Fed by: ${esc(info.feeder)} · ${esc(info.cadence)}</p>` +
      (s.facts.length ? `<ul style="margin:12px 0 0;padding-left:18px">${s.facts.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : "") +
      (s.missing.length ? `<p class="mini" style="margin-top:12px;color:#8a6a1f"><b>Still missing</b></p><ul class="mini" style="margin:2px 0 0;padding-left:18px">${s.missing.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : "") +
      `<div style="margin-top:18px"><button class="primary" data-route="chan-${c}" style="width:auto">Open ${esc(info.title)}</button></div></article>`
    );
  }).join("");
  return (
    `<div class="info">Data reaches the app by three channels, each with its own source. Open a channel to load files. Whatever is uploaded is read, recognised and previewed first, and nothing is saved until the owner confirms. This demo saves nothing.</div>` +
    `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px;margin-top:14px">${cards}</div>`
  );
}

/** Made-up workbooks shaped like what each hand-filled channel receives. */
const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

/** Manual channel: a guide tab, an equipment list that starts under a title, the sales force, and a tab nobody can place. */
export const MANUAL_SAMPLE: SheetGrid[] = [
  { sheet: "Read me", data: [["Manual data template"], ["One tab = one file. Fill only the tabs you have data for."]] },
  {
    sheet: "Installed equipment",
    data: [
      ["Equipment list kept by the service team"],
      [],
      ["Unit code", "Customer code", "Product code", "Unit name", "Installed on", "Warranty end", "Service", "Expected monthly consumables"],
      ["DEMO-U1", "DEMO-C1", "DEMO-P1", "Hematology analyzer", day(2024, 5, 12), day(2026, 5, 11), "active", 420],
      ["DEMO-U2", "DEMO-C2", "DEMO-P2", "Chemistry analyzer", day(2025, 2, 3), day(2027, 2, 2), "active", 610],
    ],
  },
  {
    sheet: "Sales team",
    data: [
      ["Name", "Email", "Suppliers", "Monthly sales target", "New accounts", "Visits per week"],
      ["Demo Sales Person A", "a@demo-company.example", "Supplier one; Supplier two", 24000, 2, 10],
      ["Demo Sales Person B", null, "Supplier two", 18000, null, 8],
    ],
  },
  { sheet: "Reminders", data: [["Who", "When"], ["Service team", "Monday"]] },
];

/** Tender channel: the department's own list, with the authority written out in full the way a hospital names it. */
export const TENDER_SAMPLE: SheetGrid[] = [
  {
    sheet: "Tender list 2026",
    data: [
      ["Authority", "Tender number", "Tender title", "Equipment or consumables", "Stage", "Estimated value", "Closing date"],
      ["Ministry of Health", "DEMO-MOH-14", "Hematology reagents, annual supply", "Consumables", "Announced", 180000, day(2026, 11, 20)],
      ["King Hussein Cancer Center", "DEMO-KHCC-3", "Chemistry analyzer with service", "Equipment", "Opportunity", 95000, null],
      ["Royal Medical Services", null, "Blood bank refrigerators", "Equipment", null, null, null],
    ],
  },
  { sheet: "Notes", data: [["Remember to renew registration"]] },
];

const SAMPLES = { manual: MANUAL_SAMPLE, tender: TENDER_SAMPLE } as const;
type SampleChannel = keyof typeof SAMPLES;
const NOUN: Record<SampleChannel, string> = { manual: "workbook", tender: "tender list" };

/** What the live upload page shows after a workbook is picked, for the sample of one channel. */
export function samplePreviewHtml(channel: SampleChannel): string {
  const reads = readWorkbook(SAMPLES[channel], CHANNEL_INFO[channel].kinds);
  const rows = reads
    .map((r) => {
      const what =
        r.skipped !== null
          ? `<span class="mini">${esc(r.skipped)}</span>`
          : r.kind
            ? `<b>${esc(SPECS[r.kind].title)}</b><span class="cellsub">Recognised from the headings · ${plural(r.rows, "row")}${r.headerRow > 1 ? ` · headings found on row ${r.headerRow}` : ""}</span>`
            : r.candidates[0]
              ? `<span class="mini">Looks like ${esc(SPECS[r.candidates[0]].title)}, which belongs in ${esc(CHANNEL_INFO[channelOfKind(r.candidates[0])].title)}. Upload it there.</span>`
              : `<span class="mini">Type not recognised: choose it, or leave it out</span>`;
      return `<tr><td data-label="Tab">${esc(r.sheet)}</td><td data-label="Understood as">${what}</td><td data-label="Used">${r.kind && r.skipped === null ? "Yes" : "No"}</td></tr>`;
    })
    .join("");
  const used = reads.filter((r) => r.kind && r.skipped === null);
  return (
    `<div class="info"><b>Preview, nothing saved yet.</b> The sample ${NOUN[channel]} has ${plural(reads.length, "tab")}. The tool read each tab on its own and found what it is.</div>` +
    `<div class="tablewrap"><table><thead><tr><th>Tab</th><th>Understood as</th><th>Used</th></tr></thead><tbody>${rows}</tbody></table></div>` +
    `<p style="margin-top:12px"><button class="primary" id="chanConfirm" style="width:auto">Confirm and save ${plural(used.length, "tab")}</button> <span class="mini">In the live app this saves the rows after the owner types a name; here it saves nothing.</span></p>`
  );
}

const sampleBox = (channel: SampleChannel, blurb: string) =>
  `<section class="panel"><div class="panelhead"><div><h2>Try a sample ${NOUN[channel]}</h2><p class="sub">${esc(blurb)}</p></div><button class="primary" id="chanSample" data-channel="${channel}" style="width:auto">Read the sample ${NOUN[channel]}</button></div><div id="chanPreview" aria-live="polite"></div></section>`;

/** The Manual channel screen. */
export function manualChannelHtml(): string {
  return (
    `<div class="info">Data that Alpha does not hold: installed equipment, the sales force with their targets and suppliers, and support-function indicators. Upload a workbook or CSV, check what the tool understood, then confirm. A starter file is available for each type.</div>` +
    sampleBox("manual", "A made-up workbook with a guide tab, an equipment list that starts under a title, the sales team, and a tab that is not data.") +
    `<p class="mini"><button class="linkbtn" data-route="salesforce">Sales force and targets</button></p>`
  );
}

/** The Tender channel screen: who feeds it, what the team has recorded, and the list upload. */
export function tenderChannelHtml(): string {
  const s = demoChannelStatus().tender;
  return (
    `<div class="info">The tender team records each tender, its stages, guarantees and payments in the Tenders section. ${esc(lastUpdateText(s, DEMO_NOW))}. ${esc(s.facts.join(" · "))}. To load or catch up a whole list at once, upload it here: a tender already recorded is updated, but its stage is only moved in the Tenders section.</div>` +
    sampleBox("tender", "A made-up tender list written the way a department keeps it: authority names in full, stages in words, one row without a number, and a notes tab.") +
    `<p class="mini"><button class="linkbtn" data-route="tenders">Open Tenders</button></p>`
  );
}
