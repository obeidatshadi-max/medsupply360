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
  "Contribution profit": "Sales minus the costs of this deal only (product, freight, installation, warranty, commission, financing). It is not net profit: company overhead and income tax are not taken off.",
  "Net recognised revenue": "The price the customer really pays for the deal, after discounts, without VAT.",
  "Contribution margin": "Contribution profit divided by net recognised revenue.",
  "Landed cost": "What the product costs when it arrives in our store: supplier price plus freight and customs.",
  "Warranty provision": "Money set aside now for repairs we promised during the warranty period.",
  "Supplier rebate": "Money the supplier gives back when we buy enough. Contractual = promised if targets are met. Earned = the targets were met. Accrued = booked in the accounts. Received = the money or credit note arrived.",
  "Quoted / Forecast / Realized": "Quoted = what we expected when we bid. Forecast = what we expect now. Realized = what the transactions prove so far.",
  "Provisionally realized": "Delivered and installed, but some money, warranty or costs are still open, so the result can still change.",
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
    `Quoted contribution margin was ${displayMargin(quoted.contributionMarginPct, "complete")}. The latest forecast is ${displayMargin(forecast.contributionMarginPct, forecast.completeness)}. What the transactions prove so far is ${displayMargin(realized.contributionMarginPct, realized.completeness)}.`,
  ];
  const imp = forecast.impact;
  const unsure = imp.estimated + imp.missing + imp.disputed + imp.unassigned;
  lines.push(unsure > 0 ? `${jod(unsure)} of the forecast rests on estimates, missing costs, disputed costs or unconfirmed matches, so treat the margin as approximate.` : "Every cost in the forecast is backed by a confirmed transaction.");
  const top = findings[0];
  lines.push(top ? `The biggest issue: ${top.title.toLowerCase()} (about ${jodAmt(top.impactJod)}).` : "No margin integrity issue was found by the rules that apply.");
  if (realized.state) lines.push(realized.state === "realized" ? "The deal is fully realized." : realized.state === "provisionally_realized" ? "The deal is provisionally realized: delivery is done but money, warranty or costs are still open." : "The deal is still open: deliveries or installation are not finished.");
  return lines;
}
