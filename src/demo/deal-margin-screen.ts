/**
 * The promotional demo's "Deal margins" screen. It renders the SAME engine and the SAME shared presentation as the app
 * (src/core/deal-margin), over three made-up deals (Scenarios A, B and C). Nothing here is Alpha ERP data and nothing is
 * saved: the simulator is a calculation in the page.
 */
import { analysePortfolio, type DealAnalysis, type SimInputs } from "@/core/deal-margin";
import { mountSimulator, mountTabs } from "@/core/deal-margin/dom";
import { DEAL_MARGIN_CSS, DEAL_TERMS_HTML, SYNTHETIC_BANNER, dealCardsHtml, dealTabsHtml, esc, findingsHtml, heldOutHtml, portfolioHtml, rebatesHtml, simulatorFormHtml, varianceHtml } from "@/core/deal-margin/html";
import { DEAL_A, DEAL_B, DEAL_C, ENTRIES_A, ENTRIES_B, ENTRIES_C, REBATES_A, REBATES_C, SYNTHETIC_POLICY } from "@/core/deal-margin/fixtures";
import { dealNarrative } from "@/core/deal-margin";

export const DEMO_DEAL_AS_OF = "2026-10-08";

const INPUTS = [
  { deal: DEAL_A, entries: ENTRIES_A, rebates: REBATES_A },
  { deal: DEAL_B, entries: ENTRIES_B, rebates: [] },
  { deal: DEAL_C, entries: ENTRIES_C, rebates: REBATES_C },
];

export function demoDealAnalyses(): DealAnalysis[] {
  return analysePortfolio(INPUTS, SYNTHETIC_POLICY, DEMO_DEAL_AS_OF).analyses;
}

export const DEMO_SIM_DEFAULTS: SimInputs = { price: 100000, discountPct: 2, supplierCost: 70000, freightCustoms: 2500, installation: 3000, warrantyProvision: 1500, commissionPct: 2, paymentDays: 90, financingRateAnnualPct: 9, rebate: 2000, rebateEligibleAndEarned: false };

/** The whole screen: overview, each deal with its waterfall and findings, the simulator, and the plain-words glossary. */
let cachedHtml: string | null = null;

/** The screen never changes (made-up data, fixed date), so it is built once. */
export function dealMarginHtml(): string {
  cachedHtml ??= buildDealMarginHtml();
  return cachedHtml;
}

function buildDealMarginHtml(): string {
  const { analyses, portfolio } = analysePortfolio(INPUTS, SYNTHETIC_POLICY, DEMO_DEAL_AS_OF);
  const deals = analyses
    .map((a, i) => {
      const entries = INPUTS.find((x) => x.deal.id === a.deal.id)!.entries;
      const story = dealNarrative(a.views, a.findings);
      return `<details class="panel"${i === 1 ? " open" : ""}><summary><b>${esc(a.deal.ref)}</b>: ${esc(a.deal.title)} <span class="tag">${a.deal.kind === "tender" ? "Tender" : "Private sale"}</span></summary>
<div class="dm">${dealCardsHtml(a)}<ul class="dm-note">${story.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
<h2>Margin waterfall</h2><p class="dm-note">Open any step to see the records behind it. A dashed or dotted bar is not backed by a confirmed transaction.</p>${dealTabsHtml(a, entries, `dm-${a.deal.id}`)}
<h2>Why the margin moved</h2>${varianceHtml(a)}<h2>Problems found and what to do</h2>${findingsHtml(a.findings)}
<h2>Supplier rebates</h2>${rebatesHtml(a)}<h2>Costs left out of the numbers, and why</h2>${heldOutHtml(a)}</div></details>`;
    })
    .join("");
  return `<style>${DEAL_MARGIN_CSS}</style><div class="dm">${SYNTHETIC_BANNER}<p class="dm-info">The limits shown here (minimum margin ${SYNTHETIC_POLICY.minContributionMarginPct}%, maximum discount ${SYNTHETIC_POLICY.maxDiscountPct}%) are made up for this demonstration. A real company enters its own; until it does, the checks that need them stay silent.</p>${portfolioHtml(portfolio, SYNTHETIC_POLICY)}</div>
<section class="panel"><div class="panelhead"><div><h2>Deals</h2><p class="sub">The quoted, forecast and realized margin of each deal, with every figure traced back to its records.</p></div></div>${deals}</section>
<section class="panel"><div class="panelhead"><div><h2>Pre-bid simulator</h2><p class="sub">Test a price before you commit. It works out the result on this page only and saves nothing.</p></div></div><div class="dm" data-dm-simbox>${simulatorFormHtml(DEMO_SIM_DEFAULTS)}<div data-dm-simresult aria-live="polite" style="margin-top:14px"></div></div></section>
<div class="dm">${DEAL_TERMS_HTML}</div>`;
}

let tabsMounted = false;

/** Wires the tabs once (they listen on the page root) and the simulator again after every render, since render replaces the DOM. */
export function mountDealMargin(root: HTMLElement): void {
  if (!tabsMounted) {
    mountTabs(root);
    tabsMounted = true;
  }
  const box = root.querySelector<HTMLElement>("[data-dm-simbox]");
  const result = root.querySelector<HTMLElement>("[data-dm-simresult]");
  if (box && result) mountSimulator(box, result, SYNTHETIC_POLICY.minContributionMarginPct);
}

/** The export button: one row per deal with the three margins and the main issue. */
export function dealMarginCsvRows(): (string | number)[][] {
  return [
    ["Deal", "Kind", "Quoted margin %", "Forecast margin %", "Realized margin %", "Realized state", "Forecast contribution JOD", "Issues", "Biggest issue"],
    ...demoDealAnalyses().map((a) => [a.deal.ref, a.deal.kind, a.views.quoted.contributionMarginPct ?? "", a.views.forecast.contributionMarginPct ?? "", a.views.realized.contributionMarginPct ?? "", a.views.realized.state ?? "", a.views.forecast.contributionAfterRebates / 1000, a.findings.length, a.findings[0]?.title ?? ""]),
  ];
}
