/** Deal Profitability & Margin Integrity Engine: public surface. */
import { findFindings, type Finding } from "./findings";
import { fromFils } from "./ledger";
import { buildViews, type DealViews } from "./views";
import { reconcile, waterfallOf, type Reconciliation, type WaterfallStep } from "./waterfall";
import { variance, type Variance } from "./variance";
import type { Deal, DealKind, LedgerEntry, MarginPolicy, RebateEntry } from "./types";

export * from "./types";
export * from "./ledger";
export * from "./views";
export * from "./waterfall";
export * from "./findings";
export * from "./variance";
export * from "./simulate";
export * from "./match";
export * from "./explain";
export * from "./outcome";

export interface DealAnalysis {
  deal: Deal;
  views: DealViews;
  waterfalls: { quoted: WaterfallStep[]; forecast: WaterfallStep[]; realized: WaterfallStep[] };
  reconciliation: { forecast: Reconciliation; realized: Reconciliation };
  quotedToForecast: Variance;
  quotedToRealized: Variance;
  findings: Finding[];
}

export interface DealInput {
  deal: Deal;
  entries: readonly LedgerEntry[];
  rebates: readonly RebateEntry[];
}

/**
 * One deal, fully analysed. `external` holds the source keys other deals already count, so one transaction is never
 * counted in two deals when the whole portfolio is analysed together (see `analysePortfolio`).
 */
export function analyseDeal(input: DealInput, policy: MarginPolicy, today: string, external: ReadonlySet<string> = new Set()): DealAnalysis {
  const views = buildViews(input.deal, input.entries, input.rebates, external);
  return {
    deal: input.deal,
    views,
    waterfalls: { quoted: waterfallOf(views.quoted), forecast: waterfallOf(views.forecast), realized: waterfallOf(views.realized) },
    reconciliation: { forecast: reconcile(views.forecast, views, policy), realized: reconcile(views.realized, views, policy) },
    quotedToForecast: variance(views.quoted, views.forecast),
    quotedToRealized: variance(views.quoted, views.realized),
    findings: findFindings({ deal: input.deal, views, policy, today }),
  };
}

const DERIVED_RULES: ReadonlySet<string> = new Set(["margin_deterioration", "below_minimum_margin", "duplicate_allocation"]);

export interface PortfolioSegment {
  kind: DealKind;
  deals: number;
  /** Realized contribution after verified rebates, in JOD. */
  verifiedContributionJod: number;
  forecastContributionJod: number;
  /** Deals whose forecast margin is under the approved minimum; null when the company has not set one. */
  belowThreshold: number | null;
  /** Sum of the profit touched by confirmed and suspected findings (not incomplete-data ones, which are listed apart). */
  profitAtRiskJod: number;
  /** Cost the forecast rests on without a confirmed transaction: estimates, missing, disputed, unassigned. */
  unverifiedCostJod: number;
}

export interface Portfolio {
  analysed: number;
  segments: PortfolioSegment[];
  total: Omit<PortfolioSegment, "kind">;
  /** Quoted-to-forecast profit effects added up across deals by cost line, worst first. */
  deteriorationDrivers: { key: string; label: string; profitEffectJod: number; deals: number }[];
  findingsByKind: Record<Finding["kind"], number>;
  topFindings: Finding[];
}

/** Every deal analysed together. Ledger entries are de-duplicated ACROSS deals: the first deal (by id) to count a source key keeps it. */
export function analysePortfolio(inputs: readonly DealInput[], policy: MarginPolicy, today: string): { analyses: DealAnalysis[]; portfolio: Portfolio } {
  const claimed = new Set<string>();
  const analyses: DealAnalysis[] = [];
  for (const input of [...inputs].sort((a, b) => a.deal.id.localeCompare(b.deal.id))) {
    const a = analyseDeal(input, policy, today, new Set(claimed));
    for (const n of a.views.classified.counted) if (n.entry.sourceKey) claimed.add(n.entry.sourceKey);
    analyses.push(a);
  }
  const seg = (list: DealAnalysis[]): Omit<PortfolioSegment, "kind"> => ({
    deals: list.length,
    verifiedContributionJod: fromFils(list.reduce((s, a) => s + a.views.realized.contributionAfterRebates, 0)),
    forecastContributionJod: fromFils(list.reduce((s, a) => s + a.views.forecast.contributionAfterRebates, 0)),
    belowThreshold: policy.minContributionMarginPct === null ? null : list.filter((a) => a.views.forecast.contributionMarginPct !== null && (a.views.forecast.contributionMarginPct as number) < (policy.minContributionMarginPct as number)).length,
    // Root causes only: "margin deterioration" and "below minimum" restate the same money as the line findings, and a
    // duplicate allocation is a reporting error, not lost profit. Adding them would count the same loss twice.
    profitAtRiskJod: Math.round(list.flatMap((a) => a.findings).filter((f) => f.kind !== "incomplete_data" && !DERIVED_RULES.has(f.rule)).reduce((s, f) => s + f.impactJod, 0) * 1000) / 1000,
    unverifiedCostJod: fromFils(list.reduce((s, a) => s + a.views.forecast.impact.estimated + a.views.forecast.impact.missing + a.views.forecast.impact.disputed + a.views.forecast.impact.unassigned, 0)),
  });
  const drivers = new Map<string, { label: string; fils: number; deals: Set<string> }>();
  for (const a of analyses) {
    for (const c of a.quotedToForecast.causes) {
      if (c.profitEffect >= 0) continue;
      const d = drivers.get(c.key) ?? { label: c.label, fils: 0, deals: new Set<string>() };
      d.fils += c.profitEffect;
      d.deals.add(a.deal.id);
      drivers.set(c.key, d);
    }
  }
  const all = analyses.flatMap((a) => a.findings);
  const kinds: Portfolio["findingsByKind"] = { confirmed: 0, suspected: 0, incomplete_data: 0 };
  for (const f of all) kinds[f.kind]++;
  const rank = { high: 0, medium: 1, low: 2 } as const;
  return {
    analyses,
    portfolio: {
      analysed: analyses.length,
      segments: (["tender", "private"] as const).map((kind) => ({ kind, ...seg(analyses.filter((a) => a.deal.kind === kind)) })),
      total: seg(analyses),
      deteriorationDrivers: [...drivers.entries()].map(([key, d]) => ({ key, label: d.label, profitEffectJod: fromFils(d.fils), deals: d.deals.size })).sort((a, b) => a.profitEffectJod - b.profitEffectJod),
      findingsByKind: kinds,
      topFindings: [...all].sort((a, b) => rank[a.severity] - rank[b.severity] || b.impactJod - a.impactJod || a.key.localeCompare(b.key)).slice(0, 8),
    },
  };
}
