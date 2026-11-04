/**
 * The Margin Integrity Engine: deterministic rules that explain why a deal's margin is not what it looked like. The same
 * deal and ledger always give the same findings, in the same order. Each finding says how much profit it touches (JOD),
 * what proves it, how sure we are, how serious it is, what to do, who answers for it, and how the fix will be checked.
 *
 * A finding is CONFIRMED when transactions prove it, SUSPECTED when the evidence points to it but a person must confirm,
 * and INCOMPLETE_DATA when a cost is simply missing so the margin cannot be trusted yet.
 * A threshold rule only fires when the company has set that threshold: nothing here invents a margin policy.
 */
import { fromFils, pct, toFils } from "./ledger";
import { COST_LABEL, type CostCategory, type Deal, type MarginPolicy } from "./types";
import type { DealViews } from "./views";

export type RuleId =
  | "missing_installation"
  | "missing_warranty"
  | "freight_overrun"
  | "installation_overrun"
  | "discount_over_policy"
  | "rebate_not_earned"
  | "supplier_credit_unreconciled"
  | "financing_delay"
  | "acquisition_variance"
  | "duplicate_allocation"
  | "wrong_deal_cost"
  | "margin_deterioration"
  | "below_minimum_margin"
  | "disputed_cost";

export type FindingKind = "confirmed" | "suspected" | "incomplete_data";
export type Severity = "high" | "medium" | "low";
export type Confidence = "high" | "medium" | "low";
export type ResponsibleFunction = "Sales manager" | "Service manager" | "Tender manager" | "Finance manager" | "Operations manager" | "Procurement manager";
export type VerificationStatus = "open" | "verified" | "not_verified";

export interface Finding {
  /** Stable key: deal id + rule + subject. Used to attach an action and to track the outcome. */
  key: string;
  dealId: string;
  rule: RuleId;
  kind: FindingKind;
  title: string;
  /** Plain-English: what happened. */
  what: string;
  /** Profit touched, in JOD (positive = profit lost or at risk). */
  impactJod: number;
  /** The same impact as percentage points of net revenue, or null without revenue. */
  impactPp: number | null;
  severity: Severity;
  confidence: Confidence;
  evidence: { entryIds: string[]; rebateIds: string[]; note: string }[];
  action: string;
  owner: ResponsibleFunction;
  verification: { method: string; status: VerificationStatus };
}

const jod = (fils: number) => `JOD ${fromFils(fils).toFixed(3)}`;

/** Display bands, not company policy: how much of net revenue a finding touches. */
function severityOf(impactFils: number, netRevenue: number, belowMinimum: boolean): Severity {
  const p = pct(Math.abs(impactFils), netRevenue);
  if (belowMinimum || (p !== null && p >= 5)) return "high";
  if (p !== null && p >= 2) return "medium";
  return "low";
}

export interface FindingsInput {
  deal: Deal;
  views: DealViews;
  policy: MarginPolicy;
  /** Today's date (ISO). Kept so date-based rules can be added without changing callers. */
  today: string;
}

export function findFindings({ deal, views, policy }: FindingsInput): Finding[] {
  const { quoted, forecast, realized } = views;
  const out: Finding[] = [];
  const rev = forecast.netRevenue > 0 ? forecast.netRevenue : realized.netRevenue;
  const belowMin = (marginAfter: number) => policy.minContributionMarginPct !== null && pct(marginAfter, rev) !== null && (pct(marginAfter, rev) as number) < policy.minContributionMarginPct;

  const add = (f: Omit<Finding, "key" | "dealId" | "impactPp" | "severity" | "verification"> & { subject?: string; verifyMethod: string; belowMinimum?: boolean; impactFils: number }) => {
    const { subject, verifyMethod, impactFils, belowMinimum, ...rest } = f;
    const severity = severityOf(impactFils, rev, belowMinimum ?? false);
    out.push({ ...rest, key: `${deal.id}:${f.rule}${subject ? `:${subject}` : ""}`, dealId: deal.id, impactPp: pct(impactFils, rev), severity, verification: { method: verifyMethod, status: "open" } });
  };

  // 1-2. A cost the deal promised or the quote expected, with no entry at all: the margin only looks good.
  const missingCost = (c: CostCategory, rule: "missing_installation" | "missing_warranty", needed: boolean, who: ResponsibleFunction, action: string) => {
    const line = forecast.lines[c];
    if (!needed || line.quoted <= 0 && c !== "warranty") return;
    if (line.ids.length > 0) return;
    const impact = line.quoted > 0 ? line.quoted : 0;
    add({
      rule,
      kind: "incomplete_data",
      title: `${COST_LABEL[c]} not recorded`,
      what: `The quote expected ${COST_LABEL[c].toLowerCase()}${impact > 0 ? ` of ${jod(impact)}` : ""}, but no cost has been booked or estimated. The margin looks better than it may really be.`,
      impactFils: impact,
      impactJod: fromFils(impact),
      confidence: "medium",
      evidence: [{ entryIds: [], rebateIds: [], note: impact > 0 ? `Quote line ${jod(impact)}, cost records: none` : "Warranty promised, cost records: none" }],
      action,
      owner: who,
      verifyMethod: `A cost (real or estimated) is recorded for ${COST_LABEL[c].toLowerCase()} and the forecast is worked out again.`,
    });
  };
  missingCost("installation", "missing_installation", deal.hasInstallation, "Service manager", "Ask the service team for the installation and commissioning cost (engineer time, travel, parts) and book it against this deal.");
  missingCost("warranty", "missing_warranty", deal.warrantyMonths > 0, "Service manager", `Set money aside for the ${deal.warrantyMonths} months of warranty promised, using the company's usual warranty rate for this product.`);

  // 3. Freight/customs and installation above the quote. Booked costs prove it (confirmed); an estimate that already
  // exceeds the quote is only a warning (suspected).
  const tolOver = (policy.costOverrunTolerancePct ?? 0) / 100;
  const overrun = (c: "freight_customs" | "installation", rule: "freight_overrun" | "installation_overrun", title: string, who: ResponsibleFunction, action: string, verifyMethod: string) => {
    const l = forecast.lines[c];
    if (l.quoted <= 0) return;
    const total = l.actual + l.estimated + l.provision + l.disputed;
    const confirmed = l.actual > l.quoted * (1 + tolOver) && l.actual - l.quoted >= 1;
    const warned = !confirmed && total > l.quoted * (1 + tolOver) && total - l.quoted >= 1;
    if (!confirmed && !warned) return;
    const basis = confirmed ? l.actual : total;
    add({
      rule,
      kind: confirmed ? "confirmed" : "suspected",
      title,
      what: confirmed ? `${COST_LABEL[c]} booked so far is ${jod(l.actual)}; the quote allowed ${jod(l.quoted)}.` : `${COST_LABEL[c]} booked and estimated together reach ${jod(total)}; the quote allowed ${jod(l.quoted)}.`,
      impactFils: basis - l.quoted,
      impactJod: fromFils(basis - l.quoted),
      confidence: confirmed ? "high" : "medium",
      evidence: [{ entryIds: l.ids, rebateIds: [], note: `${confirmed ? "Actual" : "Actual + estimate"} ${jod(basis)} vs quote ${jod(l.quoted)}` }],
      action,
      owner: who,
      verifyMethod,
    });
  };
  overrun("freight_customs", "freight_overrun", "Freight and customs above the quote", "Operations manager", "Check the forwarder and customs invoices against the quote. If the extra cost is real, reprice future bids for this route; if it is an error, ask the forwarder for a credit note.", "Freight cost is back within the quote, or the extra cost is accepted in writing and new bids use the higher figure.");
  overrun("installation", "installation_overrun", "Installation cost above the quote", "Service manager", "Review the work orders (engineer hours, travel, parts). Agree a standard installation cost per product, and decide whether the customer or the supplier should bear the extra cost.", "Installation cost is back within the quote, or the extra cost is approved and new bids use the higher standard cost.");

  // 4. Acquisition cost differs from the quote.
  const aq = forecast.lines.acquisition;
  const tolAq = (policy.costOverrunTolerancePct ?? 0) / 100;
  if (aq.quoted > 0 && aq.actual > 0 && Math.abs(aq.actual - aq.quoted) > aq.quoted * tolAq && Math.abs(aq.actual - aq.quoted) >= 1) {
    const diff = aq.actual - aq.quoted;
    if (diff > 0) {
      add({
        rule: "acquisition_variance",
        kind: "confirmed",
        title: "Product cost differs from the quoted cost",
        what: `The supplier invoices total ${jod(aq.actual)}; the quote assumed ${jod(aq.quoted)}.`,
        impactFils: diff,
        impactJod: fromFils(diff),
        confidence: "high",
        evidence: [{ entryIds: aq.ids, rebateIds: [], note: `Actual ${jod(aq.actual)} vs quote ${jod(aq.quoted)}` }],
        action: "Compare the supplier invoice with the price list used for the quote. Ask the supplier to explain the difference, and update the price list used by the tender team.",
        owner: "Procurement manager",
        verifyMethod: "The supplier cost matches the confirmed price list, or a credit note brings it back to the quote.",
      });
    }
  }

  // 5. Discount above the approved maximum (only when the company set one).
  if (policy.maxDiscountPct !== null && forecast.price > 0) {
    const given = pct(forecast.discounts, forecast.price) ?? 0;
    if (given > policy.maxDiscountPct) {
      const allowed = Math.round((forecast.price * policy.maxDiscountPct) / 100);
      const over = forecast.discounts - allowed;
      add({
        rule: "discount_over_policy",
        kind: "confirmed",
        title: "Discount above the approved limit",
        what: `The customer discount is ${given}% of the contract price; the approved limit is ${policy.maxDiscountPct}%.`,
        impactFils: over,
        impactJod: fromFils(over),
        confidence: "high",
        evidence: [{ entryIds: forecast.discountLine.ids, rebateIds: [], note: `${jod(forecast.discounts)} given, ${jod(allowed)} allowed` }],
        action: "Get the written approval for the extra discount, or take it back before the next invoice. Add the approver's name to the deal.",
        owner: "Sales manager",
        verifyMethod: "A written approval is attached, or the discount is within the approved limit.",
      });
    }
  }

  // 6. A rebate the quote counted on that is not earned.
  const rb = forecast.rebates;
  const rebateCounted = toFils(deal.quote.assumedRebate);
  if (rebateCounted > 0 && rb.verified < rebateCounted) {
    const gap = rebateCounted - rb.verified;
    add({
      rule: "rebate_not_earned",
      kind: "suspected",
      title: "Quoted margin counts a rebate that is not earned",
      what: `The quote counted on ${jod(rebateCounted)} of supplier rebate. Only ${jod(rb.verified)} has been earned, booked or received.${rb.potential > 0 ? ` ${jod(rb.potential)} is only promised: it depends on targets we have not met yet.` : ""}`,
      impactFils: gap,
      impactJod: fromFils(gap),
      confidence: rb.potential > 0 ? "medium" : "high",
      evidence: [{ entryIds: [], rebateIds: rb.ids, note: `Counted on ${jod(rebateCounted)}, earned ${jod(rb.verified)}, only promised ${jod(rb.potential)}` }],
      action: "Ask procurement for the supplier's rebate statement showing whether the target was met. Until it is, do not count this rebate in the margin.",
      owner: "Procurement manager",
      verifyMethod: "The supplier's statement shows the rebate is earned, and its status moves to earned, booked or received.",
    });
  }

  // 7. Rebate received but no supplier credit note: not reconciled.
  const unreconciledCredits = views.classified.counted.filter((n) => n.entry.line === "acquisition" && n.fils !== null && n.fils < 0 && n.entry.review !== "confirmed" && n.entry.confidence !== "exact");
  if (rb.receivedWithoutProof > 0 || unreconciledCredits.length > 0) {
    const amt = rb.receivedWithoutProof + unreconciledCredits.reduce((s, n) => s + Math.abs(n.fils ?? 0), 0);
    add({
      rule: "supplier_credit_unreconciled",
      kind: "suspected",
      title: "Supplier credit not matched to a credit note",
      what: `${jod(amt)} of supplier rebate or credit is recorded without a matching credit note or receipt.`,
      impactFils: amt,
      impactJod: fromFils(amt),
      confidence: "medium",
      evidence: [{ entryIds: unreconciledCredits.map((n) => n.entry.id), rebateIds: rb.ids, note: "Credit with no document reference" }],
      action: "Find the supplier's credit note in the ERP and link it. If there is none, treat the money as not received.",
      owner: "Finance manager",
      verifyMethod: "The supplier credit note number is recorded against the rebate.",
    });
  }

  // 8. Financing cost caused by late collection (only when a yearly rate is set).
  if (policy.financingRateAnnualPct !== null && deal.collectionDaysLate > 0 && deal.obligations.receivableOutstanding > 0) {
    const cost = toFils((deal.obligations.receivableOutstanding * (policy.financingRateAnnualPct / 100) * deal.collectionDaysLate) / 365);
    const booked = forecast.lines.financing.fils;
    const extra = cost - booked;
    if (extra > 0) {
      add({
        rule: "financing_delay",
        kind: "suspected",
        title: "Late collection is adding financing cost",
        what: `${jod(toFils(deal.obligations.receivableOutstanding))} is ${deal.collectionDaysLate} days overdue. At ${policy.financingRateAnnualPct}% a year that costs about ${jod(cost)}; ${jod(booked)} is booked.`,
        impactFils: extra,
        impactJod: fromFils(extra),
        confidence: "medium",
        evidence: [{ entryIds: forecast.lines.financing.ids, rebateIds: [], note: `Unpaid amount × ${policy.financingRateAnnualPct}% a year × ${deal.collectionDaysLate} days ÷ 365` }],
        action: "Escalate the overdue invoice with the customer's finance office and agree a payment date. Book the financing cost against this deal.",
        owner: "Finance manager",
        verifyMethod: "The invoice is paid or a dated payment plan exists, and the financing cost is booked.",
      });
    }
  }

  // 9. The same cost counted twice or already inside landed cost.
  const dupes = views.classified.heldOut.filter((h) => h.reason === "duplicate" || h.reason === "covered_by_other_line");
  const dupeFils = dupes.reduce((s, h) => s + Math.abs(h.fils ?? 0), 0);
  if (dupes.length > 0 && dupeFils > 0) {
    add({
      rule: "duplicate_allocation",
      kind: "confirmed",
      title: "The same cost was allocated more than once",
      what: `${dupes.length} entr${dupes.length === 1 ? "y" : "ies"} worth ${jod(dupeFils)} repeat a cost that is already counted, or are already included in the product cost. They were left out of this analysis. If the ERP still shows them twice, the reported profit looks lower than it really is.`,
      impactFils: dupeFils,
      impactJod: fromFils(dupeFils),
      confidence: "high",
      evidence: [{ entryIds: dupes.map((h) => h.entry.id), rebateIds: [], note: "Same ERP transaction or document line; or freight/customs already included in the product cost" }],
      action: "Ask finance to remove the repeated allocation in the ERP so deal and company reports agree.",
      owner: "Finance manager",
      verifyMethod: "The repeated costs no longer appear in the next ERP import.",
    });
  }

  // 10. Costs booked against another customer or contract (or awaiting a decision).
  const wrong = views.classified.heldOut.filter((h) => h.reason === "wrong_deal" || h.reason === "pending_review");
  const wrongFils = wrong.reduce((s, h) => s + Math.abs(h.fils ?? 0), 0);
  if (wrong.length > 0 && wrongFils > 0) {
    const confirmedWrong = wrong.filter((h) => h.reason === "wrong_deal");
    add({
      rule: "wrong_deal_cost",
      kind: "suspected",
      title: confirmedWrong.length > 0 ? "Costs may be booked against the wrong customer or contract" : "Costs waiting for a person to confirm they belong to this deal",
      what: `${wrong.length} cost entr${wrong.length === 1 ? "y" : "ies"} worth ${jod(wrongFils)} could not be tied to this deal with certainty. They are NOT in the verified margin and are not silently assigned.`,
      impactFils: wrongFils,
      impactJod: fromFils(wrongFils),
      confidence: "low",
      evidence: [{ entryIds: wrong.map((h) => h.entry.id), rebateIds: [], note: "The customer or contract reference is different, or we are not sure the cost belongs here" }],
      action: "Look at each cost: confirm it belongs to this deal, move it to the right deal, or reject it.",
      owner: "Finance manager",
      verifyMethod: "Every cost has been confirmed or rejected by a person.",
    });
  }

  // 11. Disputed costs.
  if (forecast.impact.disputed > 0) {
    add({
      rule: "disputed_cost",
      kind: "confirmed",
      title: "Costs under dispute",
      what: `${jod(forecast.impact.disputed)} of cost is contested. The forecast keeps it (worst case); realized profit leaves it out until it is settled.`,
      impactFils: forecast.impact.disputed,
      impactJod: fromFils(forecast.impact.disputed),
      confidence: "medium",
      evidence: [{ entryIds: Object.values(forecast.lines).flatMap((l) => (l.disputed !== 0 ? l.ids : [])), rebateIds: [], note: "Entries with status disputed" }],
      action: "Settle the dispute with the supplier or customer and record the agreed amount.",
      owner: "Finance manager",
      verifyMethod: "The disputed costs are replaced by the final agreed amounts.",
    });
  }

  // 12-13. Margin: deterioration and the approved minimum. Each uses the margin AFTER earned rebates.
  const qm = quoted.contributionMarginPct;
  const fm = forecast.contributionMarginPct;
  if (policy.deteriorationPp !== null && qm !== null && fm !== null && qm - fm > policy.deteriorationPp) {
    const dropFils = Math.round(((qm - fm) / 100) * forecast.netRevenue);
    add({
      rule: "margin_deterioration",
      kind: "confirmed",
      title: qm >= (policy.minContributionMarginPct ?? Infinity) && belowMin(forecast.contributionAfterRebates) ? "Profitable at award, now below the approved margin" : "Margin has fallen since the quote",
      what: `The quote promised a profit margin of ${qm}%. The forecast is ${fm}%, a fall of ${(qm - fm).toFixed(1)} points.`,
      impactFils: dropFils,
      impactJod: fromFils(dropFils),
      confidence: forecast.completeness === "complete" ? "high" : "medium",
      evidence: [{ entryIds: [], rebateIds: [], note: `Quoted ${qm}% → forecast ${fm}%` }],
      action: "Review the cost lines that moved most (see ‘Why the margin moved’) and decide whether to renegotiate, reprice the remaining deliveries, or recover costs from suppliers.",
      owner: deal.kind === "tender" ? "Tender manager" : "Sales manager",
      verifyMethod: "The forecast margin is worked out again after the action and is no longer below the quoted margin by more than the allowed fall.",
    });
  }
  if (policy.minContributionMarginPct !== null && fm !== null && fm < policy.minContributionMarginPct) {
    const shortFils = Math.round(((policy.minContributionMarginPct - fm) / 100) * forecast.netRevenue);
    add({
      rule: "below_minimum_margin",
      kind: "confirmed",
      title: "Below the approved minimum margin",
      what: `The forecast profit margin is ${fm}%; the approved minimum is ${policy.minContributionMarginPct}%.`,
      impactFils: shortFils,
      impactJod: fromFils(shortFils),
      confidence: forecast.completeness === "complete" ? "high" : "medium",
      evidence: [{ entryIds: [], rebateIds: [], note: `Forecast ${fm}% vs minimum ${policy.minContributionMarginPct}%` }],
      action: "Ask the CEO to approve or stop further deliveries at this margin, and review the cost lines that moved.",
      owner: "Sales manager",
      verifyMethod: "The forecast margin reaches the approved minimum, or a written approval for the exception is recorded.",
      belowMinimum: true,
    });
  }

  const rank = { high: 0, medium: 1, low: 2 } as const;
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || b.impactJod - a.impactJod || a.key.localeCompare(b.key));
}
