/**
 * Plain-English explanations for executives. Everything here is TEMPLATED from the deterministic engine's own output:
 * it cannot add a transaction or a number that the engine did not produce. (The app has no language model today. If one is
 * added later it may only reword these facts; it may never calculate, and any price, term, supplier or approval decision
 * stays with a person - see `needsHumanApproval`.)
 */
import { fromFils } from "./ledger";
import type { Finding, FindingKind, RuleId } from "./findings";
import type { DealViews } from "./views";
import { displayMargin } from "./variance";

/** Short meanings of the finance words used on the screens, for readers whose first language is not English. */
export const TERMS: Record<string, string> = {
  "Profit from this deal (contribution)": "Sales minus the costs of delivering this one deal: product, freight, installation, warranty, commission and the cost of waiting for payment. Company overheads and income tax are not taken off, so it is not the company's net profit.",
  "Sales after discounts": "What the customer really pays for the deal, after discounts, without VAT.",
  "Profit margin": "Profit from this deal divided by sales after discounts.",
  "Product cost on arrival": "What the product costs when it reaches our store: the supplier price plus freight and customs.",
  "Warranty set-aside": "Money kept aside now to pay for repairs we promised during the warranty.",
  "Supplier rebate": "Money a supplier gives back when we buy enough. Promised = only if we reach the target. Earned = we reached it. Booked = written in the accounts. Received = the money or credit note arrived.",
  "Quoted / Forecast / Realized": "Quoted = what we expected when we bid. Forecast = what we expect now. Realized = what real transactions prove so far.",
  "Delivered but not closed": "Delivered and installed, but some money, warranty or costs are still open, so the result can still change.",
};

const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });
const jod = (fils: number) => `JOD ${nf.format(fromFils(fils))}`;
const jodAmt = (n: number) => `JOD ${nf.format(n)}`;

export const KIND_LABEL: Record<FindingKind, string> = { confirmed: "Confirmed", suspected: "Suspected - needs a person to confirm", incomplete_data: "Incomplete data" };

/** Any action touching these needs a named person's approval; the app only suggests. */
export function needsHumanApproval(rule: RuleId): boolean {
  return ["discount_over_policy", "rebate_not_earned", "margin_deterioration", "below_minimum_margin", "acquisition_variance", "freight_overrun", "installation_overrun"].includes(rule);
}

export interface ActionPanel {
  /** The six questions a manager asks, answered from the finding. */
  whatHappened: string;
  evidence: string;
  profitAffected: string;
  whatToDo: string;
  whoIsResponsible: string;
  howVerified: string;
  approvalNote: string | null;
}

export function actionPanel(f: Finding): ActionPanel {
  const ev = f.evidence.map((e) => e.note).filter(Boolean).join("; ");
  const refs = f.evidence.reduce((n, e) => n + e.entryIds.length + e.rebateIds.length, 0);
  return {
    whatHappened: f.what,
    evidence: `${ev}${refs > 0 ? ` (${refs} source record${refs === 1 ? "" : "s"}, open the deal to see each one)` : ""}. Status: ${KIND_LABEL[f.kind]}; confidence ${f.confidence}.`,
    profitAffected: `About ${jodAmt(f.impactJod)}${f.impactPp !== null ? ` (${f.impactPp} points of margin)` : ""}.`,
    whatToDo: f.action,
    whoIsResponsible: f.owner,
    howVerified: f.verification.method,
    approvalNote: needsHumanApproval(f.rule) ? "This touches pricing, supplier terms or a financial approval. The app only suggests it: a named person must approve it." : null,
  };
}

/** The deal in four plain sentences. */
export function dealNarrative(views: DealViews, findings: readonly Finding[]): string[] {
  const { quoted, forecast, realized } = views;
  const lines = [
    `The quote promised a profit margin of ${displayMargin(quoted.contributionMarginPct, "complete")}. The latest forecast is ${displayMargin(forecast.contributionMarginPct, forecast.completeness)}. What real transactions prove so far is ${displayMargin(realized.contributionMarginPct, realized.completeness)}.`,
  ];
  const imp = forecast.impact;
  const unsure = imp.estimated + imp.missing + imp.disputed + imp.unassigned;
  lines.push(unsure > 0 ? `${jod(unsure)} of the forecast rests on estimates, missing costs, disputed costs or unconfirmed matches, so treat the margin as approximate.` : "Every cost in the forecast is backed by a confirmed transaction.");
  const top = findings[0];
  lines.push(top ? `The biggest issue: ${top.title.toLowerCase()} (about ${jodAmt(top.impactJod)}).` : "The checks found no problem with this deal.");
  if (realized.state) lines.push(realized.state === "realized" ? "The deal is closed: all figures are final." : realized.state === "provisionally_realized" ? "Delivery is done, but money, warranty or costs are still open, so the result can still change." : "The deal is still open: delivery or installation is not finished.");
  return lines;
}
