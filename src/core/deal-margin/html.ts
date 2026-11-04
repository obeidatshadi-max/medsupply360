/**
 * Shared presentation of the deal margin screens as HTML strings. The app (inside a page) and the promotional demo both
 * render through here, so the two always show the same layout and the same figures. Every dynamic value is escaped.
 * Figures that are not backed by a transaction are labelled in words (Estimate, From quote, Missing), never by colour alone.
 */
import { actionPanel, KIND_LABEL, TERMS } from "./explain";
import { fromFils } from "./ledger";
import type { Finding } from "./findings";
import type { DealAnalysis, Portfolio } from "./index";
import type { SimInputs, SimOutput } from "./simulate";
import { runSimulation } from "./simulate";
import { displayMargin, explainVariance } from "./variance";
import { waterfallOf, type WaterfallStep } from "./waterfall";
import { COST_LABEL, REBATE_LABEL, type LedgerEntry, type MarginPolicy } from "./types";
import type { Basis, ViewResult } from "./views";

export const esc = (s: unknown): string => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });
export const jodText = (fils: number): string => `${fils < 0 ? "-" : ""}JOD ${nf.format(Math.abs(fromFils(fils)))}`;
const jodPlain = (jod: number): string => `${jod < 0 ? "-" : ""}JOD ${nf.format(Math.abs(jod))}`;

export const BASIS_LABEL: Record<Basis | "calculated", string> = {
  actual: "Actual",
  estimated: "Estimate",
  mixed: "Actual + estimate",
  from_quote: "From quote: nothing recorded",
  quote: "Quoted",
  missing: "Missing",
  none: "None",
  calculated: "Calculated",
};

export const DEAL_MARGIN_CSS = `
.dm{--dm-ink:var(--ink,#1c2b25);--dm-muted:var(--muted,#5b6b64);--dm-line:var(--line,#d9e0dc);--dm-bg:var(--surface,#fff);--dm-good:#0f6b50;--dm-bad:#a02d2d;--dm-warn:#8a5a00;--dm-est:#5a4a9a;color:var(--dm-ink)}
.dm *{box-sizing:border-box}.dm h2{font-size:15px;margin:20px 0 6px}.dm h3{font-size:13px;margin:0 0 4px}.dm p{margin:4px 0}
.dm .dm-note{font-size:12px;color:var(--dm-muted)}
.dm .dm-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}
.dm .dm-card{border:1px solid var(--dm-line);background:var(--dm-bg);border-radius:8px;padding:12px}
.dm .dm-card b.dm-big{display:block;font-size:22px;margin:2px 0}
.dm .dm-chip{display:inline-block;font-size:11px;font-weight:600;border:1px solid var(--dm-line);border-radius:999px;padding:1px 8px;margin-left:4px;white-space:nowrap}
.dm .dm-chip.actual{color:var(--dm-good);border-color:var(--dm-good)}.dm .dm-chip.estimated,.dm .dm-chip.mixed{color:var(--dm-est);border-color:var(--dm-est);border-style:dashed}
.dm .dm-chip.from_quote,.dm .dm-chip.missing{color:var(--dm-bad);border-color:var(--dm-bad);border-style:dotted}.dm .dm-chip.quote{color:var(--dm-muted)}
.dm .dm-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.dm .dm-tabs button{border:1px solid var(--dm-line);background:var(--dm-bg);color:var(--dm-ink);border-radius:7px;padding:7px 12px;font:inherit;font-size:13px;cursor:pointer}
.dm .dm-tabs button[aria-selected=true]{background:var(--dm-ink);color:var(--dm-bg);font-weight:600}
.dm .dm-pane[hidden]{display:none}
.dm .wf{border:1px solid var(--dm-line);border-radius:8px;background:var(--dm-bg);overflow:hidden}
.dm .wf-row{display:grid;grid-template-columns:minmax(120px,38%) 1fr minmax(96px,auto);align-items:center;gap:8px;padding:6px 10px;border-top:1px solid var(--dm-line)}
.dm .wf-row:first-child{border-top:0}.dm .wf-row.sub{background:rgba(127,127,127,.09);font-weight:700}
.dm .wf-lab{font-size:13px;line-height:1.25}.dm .wf-val{font-size:13px;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.dm .wf-track{position:relative;height:16px;background:rgba(127,127,127,.12);border-radius:3px}
.dm .wf-bar{position:absolute;top:0;bottom:0;border-radius:3px;background:var(--dm-good)}
.dm .wf-bar.neg{background:var(--dm-bad)}.dm .wf-bar.sub{background:var(--dm-ink)}.dm .wf-bar.estimated,.dm .wf-bar.mixed{background:repeating-linear-gradient(45deg,var(--dm-est),var(--dm-est) 4px,transparent 4px,transparent 7px);outline:1px dashed var(--dm-est)}
.dm .wf-bar.from_quote,.dm .wf-bar.missing{background:transparent;outline:2px dotted var(--dm-bad)}
.dm details.wf-ev{grid-column:1/-1;margin-top:2px}.dm details.wf-ev summary{font-size:12px;color:var(--dm-muted);cursor:pointer}
.dm table{width:100%;border-collapse:collapse;font-size:13px}.dm th,.dm td{text-align:left;padding:6px 8px;border-top:1px solid var(--dm-line);vertical-align:top}.dm th{font-size:12px;color:var(--dm-muted);font-weight:600}.dm td.num,.dm th.num{text-align:right;font-variant-numeric:tabular-nums}
.dm .dm-tablewrap{overflow-x:auto;border:1px solid var(--dm-line);border-radius:8px;background:var(--dm-bg)}
.dm .dm-find{border:1px solid var(--dm-line);border-left-width:4px;border-radius:8px;background:var(--dm-bg);padding:12px;margin:8px 0}
.dm .dm-find.high{border-left-color:var(--dm-bad)}.dm .dm-find.medium{border-left-color:var(--dm-warn)}.dm .dm-find.low{border-left-color:var(--dm-muted)}
.dm .dm-six{display:grid;grid-template-columns:minmax(120px,170px) 1fr;gap:2px 12px;font-size:13px;margin:8px 0 0}.dm .dm-six dt{color:var(--dm-muted)}.dm .dm-six dd{margin:0}
.dm .dm-alert{border:1px solid var(--dm-bad);background:rgba(160,45,45,.08);border-radius:8px;padding:10px 12px;margin:10px 0;font-size:13px}
.dm .dm-info{border:1px solid var(--dm-line);background:rgba(127,127,127,.07);border-radius:8px;padding:10px 12px;margin:10px 0;font-size:13px}
.dm .dm-sim{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}.dm .dm-sim label{font-size:12px;font-weight:600;display:block}
.dm .dm-sim input,.dm .dm-sim select{display:block;width:100%;margin-top:3px;padding:7px 9px;border:1px solid var(--dm-line);border-radius:6px;font:inherit;font-size:14px;background:var(--dm-bg);color:var(--dm-ink)}
@media(max-width:560px){.dm .wf-row{grid-template-columns:1fr auto}.dm .wf-track{grid-column:1/-1;order:3}.dm .dm-six{grid-template-columns:1fr}.dm .dm-six dt{margin-top:6px}}
`;

const chip = (basis: Basis | "calculated") => (basis === "calculated" || basis === "none" ? "" : `<span class="dm-chip ${basis}">${esc(BASIS_LABEL[basis])}</span>`);

/** The honest headline for one view. */
export const viewTitle = { quoted: "Quoted", forecast: "Forecast", realized: "Closed: all figures are final" } as const;
const STATE_LABEL = { open: "Open: delivery or installation not finished", provisionally_realized: "Delivered, but money, warranty or costs are still open", realized: "Closed: all figures are final" } as const;

function entryRows(entries: readonly LedgerEntry[], ids: readonly string[], view: ViewResult): string {
  const rows = ids.map((id) => entries.find((e) => e.id === id)).filter((e): e is LedgerEntry => Boolean(e));
  if (rows.length === 0) return "";
  const body = rows
    .map((e) => {
      const src = e.source ? `${e.source.system} ${e.source.docType} ${e.source.docNo}${e.source.lineNo ? ` /${e.source.lineNo}` : ""}` : "typed by hand";
      const label = e.provision ? "Warranty set-aside (estimate)" : e.status === "estimated" ? "Estimate" : e.status === "disputed" ? "Disputed" : "Actual";
      return `<tr><td>${esc(src)}</td><td>${esc(e.incurredOn ?? "no date")}</td><td class="num">${esc(nf.format(e.amount))} ${esc(e.currency)}${e.vatIncluded ? " (incl. VAT)" : ""}</td><td>${esc(label)}</td><td>${esc(e.confidence)} · ${esc(e.review)}</td><td>${esc(e.note ?? "")}</td></tr>`;
    })
    .join("");
  void view;
  return `<details class="wf-ev"><summary>${rows.length} source record${rows.length === 1 ? "" : "s"}: open to see each</summary><div class="dm-tablewrap"><table><thead><tr><th>Source document</th><th>Date</th><th class="num">Amount</th><th>Type</th><th>How sure we are · checked?</th><th>Note</th></tr></thead><tbody>${body}</tbody></table></div></details>`;
}

/** One waterfall: a row per step, a bar scaled to the contract price, a words label for how firm the figure is, and expandable source records. */
export function waterfallHtml(v: ViewResult, entries: readonly LedgerEntry[] = []): string {
  const steps = waterfallOf(v);
  const scale = Math.max(1, v.price, ...steps.map((s) => Math.abs(s.running)));
  const pctOf = (n: number) => Math.max(0, Math.min(100, (Math.abs(n) / scale) * 100));
  const rows = steps
    .map((s: WaterfallStep) => {
      const sub = s.kind === "subtotal" || s.kind === "total";
      const startAt = s.kind === "start" || sub ? 0 : s.value < 0 ? s.running : s.running - s.value;
      const left = pctOf(startAt);
      const width = s.kind === "start" || sub ? pctOf(s.value) : pctOf(s.value);
      const cls = `wf-bar ${sub ? "sub" : s.value < 0 ? "neg" : ""} ${s.basis === "estimated" || s.basis === "mixed" || s.basis === "from_quote" || s.basis === "missing" ? s.basis : ""}`;
      const label = s.basis === "from_quote" ? `${s.label}` : s.label;
      return `<div class="wf-row ${sub ? "sub" : ""}"><div class="wf-lab">${esc(label)}${chip(s.basis)}</div><div class="wf-track" aria-hidden="true"><span class="${cls}" style="left:${left.toFixed(2)}%;width:${Math.max(width, 0.6).toFixed(2)}%"></span></div><div class="wf-val">${esc(jodText(s.value))}</div>${entryRows(entries, s.entryIds, v)}</div>`;
    })
    .join("");
  return `<div class="wf" role="table" aria-label="${esc(viewTitle[v.view])} margin waterfall">${rows}</div>`;
}

function kpi(v: ViewResult, note: string): string {
  const m = displayMargin(v.contributionMarginPct, v.completeness);
  return `<div class="dm-card"><h3>${esc(viewTitle[v.view])}</h3><b class="dm-big">${esc(m)}</b><span class="dm-note">profit margin, before supplier rebates</span><p class="dm-note">${esc(jodText(v.contributionBeforeRebates))} profit on ${esc(jodText(v.netRevenue))} of sales after discounts</p><p class="dm-note">${esc(note)}</p></div>`;
}

const COMPLETE_LABEL = { complete: "Every cost is backed by a confirmed transaction.", partial: "Rests partly on estimates, disputes or unconfirmed matches: approximate.", incomplete: "Some expected costs are missing: do not rely on this margin." } as const;

/** The three states side by side, with the realization state and the data quality in words. */
export function dealCardsHtml(a: DealAnalysis): string {
  const { quoted, forecast, realized } = a.views;
  return `<div class="dm-cards">${kpi(quoted, "What the quotation promised.")}${kpi(forecast, COMPLETE_LABEL[forecast.completeness])}${kpi(realized, realized.state ? STATE_LABEL[realized.state] : "")}</div>`;
}

export function dealTabsHtml(a: DealAnalysis, entries: readonly LedgerEntry[], idPrefix = "dm"): string {
  const views = [a.views.quoted, a.views.forecast, a.views.realized];
  const tabs = views.map((v, i) => `<button type="button" role="tab" id="${idPrefix}-t-${v.view}" aria-selected="${i === 1}" aria-controls="${idPrefix}-p-${v.view}" data-dm-tab="${v.view}">${esc(viewTitle[v.view])}</button>`).join("");
  const panes = views
    .map((v, i) => {
      const r = v.view === "quoted" ? null : a.reconciliation[v.view as "forecast" | "realized"];
      const failed = r ? r.checks.filter((c) => !c.ok).length : 0;
      const rec = r ? `<p class="dm-note">${r.ok ? `Checked: the waterfall adds up and matches the cost records (${r.checks.length} checks passed).` : `<b>Does not add up</b> against the cost records: ${failed} of ${r.checks.length} checks failed.`}</p>` : "";
      const gap = v.impact.estimated + v.impact.missing + v.impact.disputed + v.impact.unassigned;
      const impact = gap > 0 ? `<p class="dm-note">Not yet backed by a confirmed transaction: ${esc(jodText(gap))} (estimates ${esc(jodText(v.impact.estimated))}, missing ${esc(jodText(v.impact.missing))}, disputed ${esc(jodText(v.impact.disputed))}, unconfirmed matches ${esc(jodText(v.impact.unassigned))}).</p>` : "";
      return `<div class="dm-pane" role="tabpanel" id="${idPrefix}-p-${v.view}" aria-labelledby="${idPrefix}-t-${v.view}" data-dm-pane="${v.view}"${i === 1 ? "" : " hidden"}>${waterfallHtml(v, entries)}${rec}${impact}</div>`;
    })
    .join("");
  return `<div data-dm-tabs><div class="dm-tabs" role="tablist" aria-label="Choose the view">${tabs}</div>${panes}</div>`;
}

/** Why the margin moved: quote to forecast, quote to realized. */
export function varianceHtml(a: DealAnalysis): string {
  const block = (title: string, v: DealAnalysis["quotedToForecast"]) => {
    const lines = explainVariance(v);
    return `<div class="dm-card"><h3>${esc(title)}</h3><p><b>${esc(jodText(v.profitChange))}</b> change in profit${v.marginChangePp === null ? "" : `, ${v.marginChangePp >= 0 ? "+" : ""}${v.marginChangePp} margin points`}</p>${lines.length ? `<ul class="dm-note">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : `<p class="dm-note">No difference.</p>`}</div>`;
  };
  return `<div class="dm-cards">${block("Quoted → Forecast", a.quotedToForecast)}${block("Quoted → Realized", a.quotedToRealized)}</div>`;
}

export function rebatesHtml(a: DealAnalysis): string {
  const r = a.views.forecast.rebates;
  const rows = (["contractual", "earned", "accrued", "received"] as const).map((s) => `<tr><td>${esc(REBATE_LABEL[s])}</td><td class="num">${esc(jodText(r.byStatus[s]))}</td><td>${s === "contractual" ? "Never added to profit" : "Counted in profit"}</td></tr>`).join("");
  const held = r.heldOut.length ? `<p class="dm-note">${r.heldOut.length} rebate${r.heldOut.length === 1 ? "" : "s"} left out (waiting for review, rejected, or no exchange rate).</p>` : "";
  const proof = r.receivedWithoutProof > 0 ? `<p class="dm-alert">${esc(jodText(r.receivedWithoutProof))} is marked received but has no supplier credit note or receipt number.</p>` : "";
  return `<div class="dm-tablewrap"><table><thead><tr><th>Rebate status</th><th class="num">Amount</th><th>How it is counted</th></tr></thead><tbody>${rows}</tbody></table></div>${proof}<p class="dm-note">Counted as earned (earned + booked + received): <b>${esc(jodText(r.verified))}</b>. The quote counted on ${esc(jodText(Math.round(a.deal.quote.assumedRebate * 1000)))}.</p>${held}`;
}

const HELD_REASON = { duplicate: "Repeats a transaction already counted", covered_by_other_line: "Already included in another line (for example, freight inside the product cost)", wrong_deal: "Belongs to another customer or contract", pending_review: "Waiting for a person to confirm it belongs here", rejected: "Rejected by a person", no_fx_rate: "Foreign currency with no exchange rate" } as const;

/** Entries the analysis left out, with the reason: nothing disappears silently. */
export function heldOutHtml(a: DealAnalysis): string {
  const h = a.views.classified.heldOut;
  if (h.length === 0) return `<p class="dm-note">Every recorded cost is counted. Nothing was left out.</p>`;
  const rows = h.map((x) => `<tr><td>${esc(x.entry.line.replace("_", " "))}</td><td class="num">${esc(nf.format(x.entry.amount))} ${esc(x.entry.currency)}</td><td>${esc(HELD_REASON[x.reason])}</td><td>${esc(x.entry.source ? `${x.entry.source.docType} ${x.entry.source.docNo}` : "typed by hand")}</td></tr>`).join("");
  return `<div class="dm-tablewrap"><table><thead><tr><th>Line</th><th class="num">Amount</th><th>Why it is not counted</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function findingHtml(f: Finding): string {
  const p = actionPanel(f);
  return `<article class="dm-find ${f.severity}"><h3>${esc(f.title)} <span class="dm-chip">${esc(KIND_LABEL[f.kind])}</span><span class="dm-chip">${esc(f.severity)} severity</span></h3><dl class="dm-six"><dt>What happened</dt><dd>${esc(p.whatHappened)}</dd><dt>Evidence</dt><dd>${esc(p.evidence)}</dd><dt>Profit affected</dt><dd>${esc(p.profitAffected)}</dd><dt>What to do</dt><dd>${esc(p.whatToDo)}</dd><dt>Responsible</dt><dd>${esc(p.whoIsResponsible)}</dd><dt>How we will check it worked</dt><dd>${esc(p.howVerified)}</dd></dl>${p.approvalNote ? `<p class="dm-note"><b>Approval needed.</b> ${esc(p.approvalNote)}</p>` : ""}</article>`;
}

export function findingsHtml(list: readonly Finding[]): string {
  if (list.length === 0) return `<p class="dm-info">The checks found no problem with this deal. Checks that need a company limit stay silent until the owner sets it.</p>`;
  const group = (kind: Finding["kind"], title: string) => {
    const items = list.filter((f) => f.kind === kind);
    return items.length ? `<h3 style="margin-top:12px">${esc(title)} (${items.length})</h3>${items.map(findingHtml).join("")}` : "";
  };
  return `${group("confirmed", "Confirmed by transactions")}${group("suspected", "Suspected: a person must confirm")}${group("incomplete_data", "Incomplete data: the margin cannot be trusted yet")}`;
}

const SEGMENT_LABEL = { tender: "Tenders", private: "Private-sector sales" } as const;

/** The CEO's portfolio overview. `belowThreshold` is shown as "not set" until the company enters a minimum margin. */
export function portfolioHtml(p: Portfolio, policy: MarginPolicy): string {
  const set = policy.minContributionMarginPct !== null;
  const row = (title: string, s: Portfolio["total"]) => `<tr><td><b>${esc(title)}</b></td><td class="num">${s.deals}</td><td class="num">${esc(jodPlain(s.verifiedContributionJod))}</td><td class="num">${esc(jodPlain(s.forecastContributionJod))}</td><td class="num">${s.belowThreshold === null ? "no limit set" : s.belowThreshold}</td><td class="num">${esc(jodPlain(s.profitAtRiskJod))}</td><td class="num">${esc(jodPlain(s.unverifiedCostJod))}</td></tr>`;
  const drivers = p.deteriorationDrivers.length
    ? `<ul class="dm-note">${p.deteriorationDrivers.slice(0, 5).map((d) => `<li>${esc(d.label)}: ${esc(jodPlain(d.profitEffectJod))} across ${d.deals} deal${d.deals === 1 ? "" : "s"}</li>`).join("")}</ul>`
    : `<p class="dm-note">No cost line has moved against a quote.</p>`;
  return `<div class="dm-cards"><div class="dm-card"><h3>Deals analysed</h3><b class="dm-big">${p.analysed}</b></div><div class="dm-card"><h3>Profit proven by transactions</h3><b class="dm-big">${esc(jodPlain(p.total.verifiedContributionJod))}</b><span class="dm-note">only what transactions prove</span></div><div class="dm-card"><h3>Below approved margin</h3><b class="dm-big">${p.total.belowThreshold === null ? "n/a" : p.total.belowThreshold}</b><span class="dm-note">${set ? `minimum ${policy.minContributionMarginPct}%` : "the company has not set a minimum margin"}</span></div><div class="dm-card"><h3>Profit at risk</h3><b class="dm-big">${esc(jodPlain(p.total.profitAtRiskJod))}</b><span class="dm-note">confirmed and suspected findings</span></div><div class="dm-card"><h3>Costs not yet proven</h3><b class="dm-big">${esc(jodPlain(p.total.unverifiedCostJod))}</b><span class="dm-note">estimates, missing, disputed, unconfirmed</span></div></div>
<h2>Tenders and private sales, shown separately</h2><div class="dm-tablewrap"><table><thead><tr><th>Segment</th><th class="num">Deals</th><th class="num">Proven profit</th><th class="num">Expected profit</th><th class="num">Below minimum margin</th><th class="num">Profit at risk</th><th class="num">Costs not yet proven</th></tr></thead><tbody>${p.segments.map((s) => row(SEGMENT_LABEL[s.kind], s)).join("")}</tbody></table></div>
<h2>What is eroding margin most</h2>${drivers}<p class="dm-note">Findings: ${p.findingsByKind.confirmed} confirmed, ${p.findingsByKind.suspected} suspected, ${p.findingsByKind.incomplete_data} with incomplete data.</p>`;
}

export const SIM_FIELDS: { key: keyof SimInputs; label: string; hint: string; step?: string }[] = [
  { key: "price", label: "Selling price (JOD, without VAT)", hint: "" },
  { key: "discountPct", label: "Discount (%)", hint: "", step: "0.1" },
  { key: "supplierCost", label: "Supplier cost (JOD)", hint: "" },
  { key: "freightCustoms", label: "Freight and customs (JOD)", hint: "" },
  { key: "installation", label: "Installation cost (JOD)", hint: "0 = none. Confirm it." },
  { key: "warrantyProvision", label: "Warranty set-aside (JOD)", hint: "0 = none. Confirm it." },
  { key: "commissionPct", label: "Commission (% of net revenue)", hint: "", step: "0.1" },
  { key: "paymentDays", label: "Payment terms (days to be paid)", hint: "", step: "1" },
  { key: "financingRateAnnualPct", label: "Cost of waiting for payment (% a year)", hint: "Empty = not priced", step: "0.1" },
  { key: "rebate", label: "Supplier rebate (JOD)", hint: "" },
];

export function simulatorFormHtml(d: SimInputs): string {
  const fields = SIM_FIELDS.map((f) => `<label>${esc(f.label)}<input name="${f.key}" inputmode="decimal" autocomplete="off" value="${d[f.key] === null ? "" : esc(String(d[f.key]))}"${f.step ? ` data-step="${f.step}"` : ""}><span class="dm-note">${esc(f.hint)}</span></label>`).join("");
  return `<form class="dm-sim" data-dm-sim onsubmit="return false">${fields}<label>Is the rebate eligible and earned?<select name="rebateEligibleAndEarned"><option value="no"${d.rebateEligibleAndEarned ? "" : " selected"}>No: do not count it</option><option value="yes"${d.rebateEligibleAndEarned ? " selected" : ""}>Yes: eligible and earned</option></select></label></form>`;
}

/** Reads the simulator form's text fields into numbers. A field left empty is 0, except the financing rate, where empty means "not priced". */
export function readSimInputs(get: (name: string) => string): SimInputs {
  const n = (k: string) => {
    const v = Number(get(k).replace(/,/g, "").trim());
    return Number.isFinite(v) ? v : 0;
  };
  const rateText = get("financingRateAnnualPct").trim();
  return {
    price: n("price"), discountPct: n("discountPct"), supplierCost: n("supplierCost"), freightCustoms: n("freightCustoms"), installation: n("installation"), warrantyProvision: n("warrantyProvision"),
    commissionPct: n("commissionPct"), paymentDays: n("paymentDays"), financingRateAnnualPct: rateText === "" ? null : n("financingRateAnnualPct"), rebate: n("rebate"), rebateEligibleAndEarned: get("rebateEligibleAndEarned") === "yes",
  };
}

export function simulationResultHtml(o: SimOutput): string {
  const r = o.result;
  const marginText = r.marginPct === null ? "n/a" : `${r.marginPct.toFixed(1)}%`;
  const below = o.targetMarginPct !== null && r.marginPct !== null && r.marginPct < o.targetMarginPct;
  const min = o.minPrice !== null ? `<b>${esc(jodPlain(o.minPrice))}</b> before discount reaches the ${o.targetMarginPct}% minimum margin.` : esc(o.minPriceReason ?? "");
  const rows = o.sensitivities.map((s) => `<tr><td>${esc(s.label)}</td><td>${esc(s.stepLabel)}</td><td class="num">${esc(jodText(s.contributionDelta))}</td><td class="num">${s.marginDeltaPp === null ? "n/a" : `${s.marginDeltaPp >= 0 ? "+" : ""}${s.marginDeltaPp} pts`}</td></tr>`).join("");
  return `<div class="dm-cards"><div class="dm-card"><h3>Profit margin</h3><b class="dm-big">${esc(marginText)}</b>${below ? `<p class="dm-alert">Below the approved minimum of ${o.targetMarginPct}%.</p>` : ""}</div><div class="dm-card"><h3>Profit from this deal</h3><b class="dm-big">${esc(jodText(r.contribution))}</b><span class="dm-note">on ${esc(jodText(r.netRevenue))} of sales after discounts</span></div><div class="dm-card"><h3>Minimum selling price</h3><p>${min}</p></div></div>
${r.caveats.length ? `<div class="dm-info"><b>Check before you rely on this:</b><ul>${r.caveats.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>` : ""}
<h2>Which assumption matters most</h2><div class="dm-tablewrap"><table><thead><tr><th>Assumption</th><th>Moves by</th><th class="num">Change in profit</th><th class="num">Change in margin</th></tr></thead><tbody>${rows}</tbody></table></div><p class="dm-note">This is a calculation only. It does not read or change any deal, cost or accounting record.</p>`;
}

export const simulationHtml = (inputs: SimInputs, target: number | null): string => simulationResultHtml(runSimulation(inputs, target));

export const DEAL_TERMS_HTML = `<details class="dm-info"><summary><b>Finance words in simple English</b></summary>${Object.entries(TERMS).map(([k, v]) => `<p><b>${esc(k)}:</b> ${esc(v)}</p>`).join("")}</details>`;

export const SYNTHETIC_BANNER = `<p class="dm-info"><b>Made-up data.</b> Every customer, supplier, number and document on this screen is synthetic. It is not Alpha ERP data and does not show a verified integration.</p>`;

/** Costs of one cost line, named, for headings. */
export const lineName = (c: keyof typeof COST_LABEL) => COST_LABEL[c];
