import { describe, expect, it } from "vitest";
import {
  analyseDeal,
  analysePortfolio,
  buildViews,
  classify,
  displayMargin,
  entryFils,
  fromFils,
  matchTransaction,
  mergeImport,
  minimumPrice,
  reconcile,
  runSimulation,
  simulate,
  toFils,
  variance,
  verifyOutcome,
  waterfallOf,
  EMPTY_POLICY,
  type DealIdentifiers,
  type ErpTransaction,
  type SimInputs,
} from "./index";
import { DEAL_A, DEAL_B, DEAL_C, ENTRIES_A, ENTRIES_B, ENTRIES_C, REBATES_A, REBATES_C, SYNTHETIC_POLICY, entry, rebate } from "./fixtures";
import type { Deal } from "./types";

const TODAY = "2026-11-04";
const A = () => analyseDeal({ deal: DEAL_A, entries: ENTRIES_A, rebates: REBATES_A }, SYNTHETIC_POLICY, TODAY);
const B = () => analyseDeal({ deal: DEAL_B, entries: ENTRIES_B, rebates: [] }, SYNTHETIC_POLICY, TODAY);
const C = () => analyseDeal({ deal: DEAL_C, entries: ENTRIES_C, rebates: REBATES_C }, SYNTHETIC_POLICY, TODAY);
const rules = (a: ReturnType<typeof A>) => a.findings.map((f) => f.rule);

describe("money rules", () => {
  it("rounds to whole fils symmetrically", () => {
    expect(toFils(1.0005)).toBe(1001);
    expect(toFils(-1.0005)).toBe(-1001);
    expect(toFils(0)).toBe(0);
    expect(fromFils(18640000)).toBe(18640);
  });
  it("strips VAT that is included in an amount (VAT is recoverable, not a cost)", () => {
    const e = entry("X", "freight_customs", 1160, { vatIncluded: true, vatRate: 0.16 });
    expect(entryFils(e)).toBe(1000000);
  });
  it("converts a foreign currency at the entry's own rate and holds out an entry with no rate", () => {
    const usd = entry("X", "acquisition", 1000, { currency: "USD", fxRate: 0.709 });
    expect(entryFils(usd)).toBe(709000);
    const noRate = entry("X", "acquisition", 1000, { currency: "IQD", fxRate: null });
    expect(entryFils(noRate)).toBeNull();
    const c = classify({ ...DEAL_A, id: "X" }, [usd, noRate]);
    expect(c.counted).toHaveLength(1);
    expect(c.heldOut.map((h) => h.reason)).toEqual(["no_fx_rate"]);
  });
  it("converts a VAT-inclusive foreign amount: strip VAT first, then convert", () => {
    expect(entryFils(entry("X", "other", 1160, { currency: "USD", fxRate: 0.709, vatIncluded: true, vatRate: 0.16 }))).toBe(709000);
  });
});

describe("Scenario A: profitable tender, fully reconciled", () => {
  it("waterfall arithmetic is exact", () => {
    const a = A();
    const f = a.views.forecast;
    expect(fromFils(f.price)).toBe(100000);
    expect(fromFils(f.discounts)).toBe(2000);
    expect(fromFils(f.netRevenue)).toBe(98000);
    expect(fromFils(f.grossProfit)).toBe(28000);
    expect(fromFils(f.fulfilmentCost)).toBe(9360);
    expect(fromFils(f.totalCost)).toBe(79360);
    expect(fromFils(f.contributionBeforeRebates)).toBe(18640);
    expect(fromFils(f.contributionAfterRebates)).toBe(20640);
  });
  it("uses net recognised revenue as the denominator for every percentage", () => {
    const f = A().views.forecast;
    expect(f.grossMarginPct).toBe(Math.round((28000 / 98000) * 1000) / 10);
    expect(f.contributionMarginPct).toBe(19);
    expect(f.marginAfterRebatesPct).toBe(21.1);
  });
  it("forecast equals realized, and the deal is fully realized", () => {
    const a = A();
    expect(a.views.realized.contributionAfterRebates).toBe(a.views.forecast.contributionAfterRebates);
    expect(a.views.realized.contributionAfterRebates).toBe(a.views.quoted.contributionBeforeRebates + toFils(2000));
    expect(a.views.realized.state).toBe("realized");
    expect(a.views.forecast.completeness).toBe("complete");
  });
  it("reconciles to the ledger and finds nothing wrong", () => {
    const a = A();
    expect(a.reconciliation.forecast.ok).toBe(true);
    expect(a.reconciliation.realized.ok).toBe(true);
    expect(a.findings).toEqual([]);
  });
  it("traces every waterfall step to ledger entries", () => {
    const steps = A().waterfalls.realized;
    expect(steps.find((s) => s.key === "acquisition")!.entryIds).toHaveLength(2);
    expect(steps.map((s) => s.key)).toEqual(["price", "discount", "net_revenue", "acquisition", "freight_customs", "installation", "warranty", "commission", "financing", "other", "contribution_before", "rebates", "contribution_after"]);
    expect(steps.at(-1)!.value).toBe(A().views.realized.contributionAfterRebates);
  });
});

describe("Scenario B: tender deteriorating through installation and freight overruns", () => {
  it("quoted margin looks fine; forecast and realized fall", () => {
    const b = B();
    expect(b.views.quoted.contributionMarginPct).toBe(21);
    expect(b.views.forecast.contributionMarginPct).toBeCloseTo(11.8, 1);
    expect(b.views.realized.contributionMarginPct).toBeGreaterThan(b.views.forecast.contributionMarginPct as number);
    expect(b.views.realized.contributionMarginPct).toBeLessThan(21);
  });
  it("explains the fall by cost line, and the causes add up to the profit change", () => {
    const v = B().quotedToForecast;
    expect(v.causes[0].key).toBe("installation");
    expect(v.causes.reduce((s, c) => s + c.profitEffect, 0)).toBe(v.profitChange);
    expect(fromFils(v.profitChange)).toBe(-18500);
  });
  it("raises overrun, late-collection, below-minimum and deterioration findings, worst first", () => {
    const b = B();
    expect(rules(b)).toEqual(expect.arrayContaining(["freight_overrun", "installation_overrun", "financing_delay", "below_minimum_margin", "margin_deterioration"]));
    const fr = b.findings.find((f) => f.rule === "freight_overrun")!;
    expect(fr.kind).toBe("confirmed");
    expect(fr.impactJod).toBe(5500);
    expect(fr.owner).toBe("Operations manager");
    const fin = b.findings.find((f) => f.rule === "financing_delay")!;
    // 60,000 x 9% x 90/365 = 1,331.507 minus 1,000 already booked
    expect(fin.impactJod).toBeCloseTo(331.507, 3);
    expect(b.findings.map((f) => f.severity)[0]).toBe("high");
  });
  it("is open while installation is incomplete and carries unverified cost", () => {
    const b = B();
    expect(b.views.realized.state).toBe("open");
    expect(fromFils(b.views.forecast.impact.estimated)).toBe(5000);
    expect(b.views.forecast.completeness).toBe("partial");
  });
  it("counts partial installation: realized holds out the estimate, forecast keeps it", () => {
    const b = B();
    expect(fromFils(b.views.realized.lines.installation.fils)).toBe(14000);
    expect(fromFils(b.views.forecast.lines.installation.fils)).toBe(19000);
  });
  it("with no thresholds set, threshold rules stay silent (no invented policy)", () => {
    const b = analyseDeal({ deal: DEAL_B, entries: ENTRIES_B, rebates: [] }, EMPTY_POLICY, TODAY);
    expect(rules(b)).not.toContain("below_minimum_margin");
    expect(rules(b)).not.toContain("margin_deterioration");
    expect(rules(b)).not.toContain("financing_delay");
    expect(rules(b)).toContain("freight_overrun");
  });
});

describe("Scenario C: looks profitable on uncertain rebate and missing warranty/installation", () => {
  it("does not add a contractual rebate to verified profit", () => {
    const c = C();
    expect(fromFils(c.views.forecast.rebates.potential)).toBe(6000);
    expect(fromFils(c.views.forecast.rebates.verified)).toBe(1000);
    expect(fromFils(c.views.forecast.contributionAfterRebates - c.views.forecast.contributionBeforeRebates)).toBe(1000);
  });
  it("separates rebates by recognition and receipt status", () => {
    const r = C().views.forecast.rebates;
    expect(fromFils(r.byStatus.contractual)).toBe(6000);
    expect(fromFils(r.byStatus.received)).toBe(1000);
    expect(r.byStatus.earned + r.byStatus.accrued).toBe(0);
    expect(fromFils(r.receivedWithoutProof)).toBe(1000);
  });
  it("flags the missing installation and warranty cost, the unearned rebate, the unreconciled credit and the unconfirmed cost", () => {
    const c = C();
    expect(rules(c)).toEqual(expect.arrayContaining(["missing_installation", "missing_warranty", "rebate_not_earned", "supplier_credit_unreconciled", "wrong_deal_cost"]));
    expect(c.findings.find((f) => f.rule === "rebate_not_earned")!.impactJod).toBe(5000);
    expect(c.findings.find((f) => f.rule === "missing_installation")!.kind).toBe("incomplete_data");
    expect(c.findings.find((f) => f.rule === "rebate_not_earned")!.kind).toBe("suspected");
  });
  it("keeps the pending installation invoice out of verified cost but reports it", () => {
    const c = C();
    expect(c.views.classified.heldOut.map((h) => h.reason)).toEqual(["pending_review"]);
    expect(fromFils(c.views.forecast.impact.unassigned)).toBe(2400);
    expect(c.views.forecast.completeness).toBe("incomplete");
  });
  it("shows an approximate margin, not a falsely precise one, when data are incomplete", () => {
    const c = C();
    expect(displayMargin(c.views.forecast.contributionMarginPct, c.views.forecast.completeness)).toMatch(/^about \d+%$/);
    expect(displayMargin(19, "complete")).toBe("19.0%");
    expect(displayMargin(null, "complete")).toBe("n/a");
  });
});

describe("discounts, credit notes and landed-cost double counting", () => {
  const deal: Deal = { ...DEAL_A, id: "D" };
  it("a customer credit note reduces the discount line; a supplier credit note reduces product cost", () => {
    const entries = [entry("D", "discount", 3000), entry("D", "discount", -500, { note: "credit note reversal" }), entry("D", "acquisition", 70000), entry("D", "acquisition", -1000, { note: "supplier credit note" })];
    const v = buildViews(deal, entries).forecast;
    expect(fromFils(v.discounts)).toBe(2500);
    expect(fromFils(v.lines.acquisition.fils)).toBe(69000);
    expect(fromFils(v.netRevenue)).toBe(97500);
  });
  it("freight already inside landed cost is held out, not counted twice", () => {
    const entries = [entry("D", "acquisition", 72500), entry("D", "freight_customs", 2500, { coveredBy: "acquisition" })];
    const v = buildViews(deal, entries);
    expect(fromFils(v.forecast.lines.freight_customs.fils)).toBe(2500); // from the quote: nothing was counted
    expect(v.forecast.lines.freight_customs.basis).toBe("from_quote");
    expect(v.classified.heldOut[0].reason).toBe("covered_by_other_line");
  });
  it("the same ERP transaction counts once, by source key and by document line", () => {
    const e1 = entry("D", "installation", 3000, { id: "d1", sourceKey: "ERP:1" });
    const e2 = entry("D", "installation", 3000, { id: "d2", sourceKey: "ERP:1" });
    const e3 = entry("D", "commission", 100, { id: "d3", sourceKey: "ERP:3", source: { system: "ERP", docType: "inv", docNo: "9", lineNo: "1" } });
    const e4 = entry("D", "commission", 100, { id: "d4", sourceKey: "ERP:4", source: { system: "ERP", docType: "inv", docNo: "9", lineNo: "1" } });
    const c = classify(deal, [e1, e2, e3, e4]);
    expect(c.counted.map((n) => n.entry.id)).toEqual(["d1", "d3"]);
    expect(c.heldOut.every((h) => h.reason === "duplicate")).toBe(true);
    expect(c.heldOut.map((h) => h.keptId)).toEqual(["d1", "d3"]);
  });
  it("a duplicate allocation becomes a confirmed finding with its JOD impact", () => {
    const entries = [entry("D", "acquisition", 70000), entry("D", "installation", 3000, { id: "x1", sourceKey: "K" }), entry("D", "installation", 3000, { id: "x2", sourceKey: "K" })];
    const a = analyseDeal({ deal, entries, rebates: [] }, EMPTY_POLICY, TODAY);
    const f = a.findings.find((x) => x.rule === "duplicate_allocation")!;
    expect(f.kind).toBe("confirmed");
    expect(f.impactJod).toBe(3000);
  });
  it("a transaction cannot be counted by two deals in a portfolio", () => {
    const d1: Deal = { ...DEAL_A, id: "P1" };
    const d2: Deal = { ...DEAL_A, id: "P2" };
    const shared = { sourceKey: "SHARED" };
    const { analyses } = analysePortfolio(
      [
        { deal: d1, entries: [entry("P1", "installation", 3000, shared)], rebates: [] },
        { deal: d2, entries: [entry("P2", "installation", 3000, shared)], rebates: [] },
      ],
      EMPTY_POLICY,
      TODAY,
    );
    const counted = analyses.flatMap((a) => a.views.classified.counted).length;
    expect(counted).toBe(1);
  });
  it("a cost booked against another customer or contract is held out of this deal", () => {
    const entries = [entry("D", "installation", 3000, { customerRef: "SOMEONE-ELSE" }), entry("D", "installation", 100, { dealId: "OTHER" })];
    const c = classify({ ...deal, customerRef: "SYN-MOH-1" }, entries);
    expect(c.counted).toHaveLength(0);
    expect(c.heldOut.map((h) => h.reason)).toEqual(["wrong_deal", "wrong_deal"]);
  });
});

describe("rebate recognition", () => {
  const deal: Deal = { ...DEAL_A, id: "R" };
  it("only earned, accrued and received rebates enter verified profit", () => {
    const reb = [rebate("R", "contractual", 500), rebate("R", "earned", 100), rebate("R", "accrued", 200), rebate("R", "received", 300, { creditNoteRef: "CN" })];
    const v = buildViews(deal, [], reb).forecast.rebates;
    expect(fromFils(v.verified)).toBe(600);
    expect(fromFils(v.potential)).toBe(500);
  });
  it("a rebate awaiting review or rejected is held out and listed", () => {
    const reb = [rebate("R", "earned", 100, { review: "pending" }), rebate("R", "earned", 100, { review: "rejected" }), rebate("R", "earned", 100, { currency: "USD", fxRate: null })];
    const v = buildViews(deal, [], reb).forecast.rebates;
    expect(v.verified).toBe(0);
    expect(v.heldOut.map((h) => h.reason)).toEqual(["pending_review", "rejected", "no_fx_rate"]);
  });
});

describe("open obligations", () => {
  it("open warranty makes a delivered, installed deal provisionally realized", () => {
    const deal: Deal = { ...DEAL_A, id: "W", obligations: { ...DEAL_A.obligations, warrantyOpen: true } };
    const v = buildViews(deal, ENTRIES_A.map((e) => ({ ...e, dealId: "W" })), []);
    expect(v.realized.state).toBe("provisionally_realized");
  });
  it("unpaid receivables or a partial delivery keep the deal from looking complete", () => {
    const base = ENTRIES_A.map((e) => ({ ...e, dealId: "W" }));
    expect(buildViews({ ...DEAL_A, id: "W", obligations: { ...DEAL_A.obligations, receivableOutstanding: 10 } }, base, []).realized.state).toBe("provisionally_realized");
    expect(buildViews({ ...DEAL_A, id: "W", obligations: { ...DEAL_A.obligations, deliveredPct: 60 } }, base, []).realized.state).toBe("open");
    expect(buildViews({ ...DEAL_A, id: "W", obligations: { ...DEAL_A.obligations, deliveredPct: null } }, base, []).realized.state).toBe("open");
  });
  it("a delivery with unknown installation progress is open when installation is part of the deal", () => {
    const deal: Deal = { ...DEAL_A, id: "W", obligations: { ...DEAL_A.obligations, installedPct: null } };
    expect(buildViews(deal, ENTRIES_A.map((e) => ({ ...e, dealId: "W" })), []).realized.state).toBe("open");
  });
});

describe("reconciliation tolerance", () => {
  it("passes within the configured rounding tolerance and fails outside it", () => {
    const v = A().views.forecast;
    expect(reconcile(v, A().views, { roundingToleranceFils: 1 }).ok).toBe(true);
    const tampered = { ...v, contributionAfterRebates: v.contributionAfterRebates + 5 };
    expect(reconcile(tampered, A().views, { roundingToleranceFils: 1 }).ok).toBe(false);
    expect(reconcile(tampered, A().views, { roundingToleranceFils: 5 }).ok).toBe(true);
  });
  it("every scenario's waterfall ties to its ledger", () => {
    for (const a of [A(), B(), C()]) {
      expect(a.reconciliation.forecast.ok).toBe(true);
      expect(a.reconciliation.realized.ok).toBe(true);
    }
  });
  it("the final waterfall step always equals the view's contribution after rebates", () => {
    for (const a of [A(), B(), C()]) for (const view of ["quoted", "forecast", "realized"] as const) expect(waterfallOf(a.views[view]).at(-1)!.value).toBe(a.views[view].contributionAfterRebates);
  });
});

describe("quoted, forecast and realized stay consistent", () => {
  it("with no ledger at all, forecast = quote (everything from the quote) and realized shows missing costs", () => {
    const v = buildViews({ ...DEAL_B, id: "Z" }, [], []);
    expect(v.forecast.contributionBeforeRebates).toBe(v.quoted.contributionBeforeRebates);
    expect(v.forecast.completeness).toBe("incomplete");
    expect(fromFils(v.forecast.impact.missing)).toBe(158000);
    expect(v.realized.totalCost).toBe(0);
    expect(v.realized.impact.missing).toBe(v.forecast.impact.missing);
  });
  it("quoted view is identical regardless of the ledger", () => {
    expect(B().views.quoted).toEqual(buildViews(DEAL_B, [], []).quoted);
  });
  it("variance compares only differences and adds up for every pair", () => {
    for (const a of [A(), B(), C()]) {
      for (const v of [a.quotedToForecast, a.quotedToRealized]) expect(v.causes.reduce((s, c) => s + c.profitEffect, 0)).toBe(v.profitChange);
    }
    expect(variance(A().views.quoted, A().views.forecast).causes).toEqual([]);
  });
});

describe("deterministic and portfolio", () => {
  it("same input, same output, regardless of entry order", () => {
    const shuffled = [...ENTRIES_B].reverse();
    expect(analyseDeal({ deal: DEAL_B, entries: shuffled, rebates: [] }, SYNTHETIC_POLICY, TODAY)).toEqual(B());
  });
  it("portfolio separates tender and private performance and totals the deals", () => {
    const { portfolio } = analysePortfolio(
      [
        { deal: DEAL_A, entries: ENTRIES_A, rebates: REBATES_A },
        { deal: DEAL_B, entries: ENTRIES_B, rebates: [] },
        { deal: DEAL_C, entries: ENTRIES_C, rebates: REBATES_C },
      ],
      SYNTHETIC_POLICY,
      TODAY,
    );
    expect(portfolio.analysed).toBe(3);
    expect(portfolio.segments.find((s) => s.kind === "tender")!.deals).toBe(2);
    expect(portfolio.segments.find((s) => s.kind === "private")!.deals).toBe(1);
    expect(portfolio.total.belowThreshold).toBe(1);
    expect(portfolio.deteriorationDrivers[0].profitEffectJod).toBeLessThan(0);
    expect(portfolio.total.unverifiedCostJod).toBeGreaterThan(0);
  });
  it("profit at risk counts root causes once: deterioration and below-minimum restate the line overruns", () => {
    const { portfolio } = analysePortfolio([{ deal: DEAL_B, entries: ENTRIES_B, rebates: [] }], SYNTHETIC_POLICY, TODAY);
    // freight 5,500 + installation 8,000 + late-collection financing 331.507
    expect(portfolio.total.profitAtRiskJod).toBeCloseTo(13831.507, 3);
  });
  it("threshold count is null (not zero) when the company has set no minimum margin", () => {
    const { portfolio } = analysePortfolio([{ deal: DEAL_A, entries: ENTRIES_A, rebates: REBATES_A }], EMPTY_POLICY, TODAY);
    expect(portfolio.total.belowThreshold).toBeNull();
  });
});

describe("ERP matching never silently assigns an uncertain transaction", () => {
  const ids = (over: Partial<DealIdentifiers>): DealIdentifiers => ({ dealId: "A", contractNo: "C-100", tenderNo: "T-1", projectRefs: ["PRJ-1"], invoiceNos: ["INV-9"], serials: ["SN1"], poNos: ["PO-5"], customerRef: "CUST-1", customerName: "Synthetic Hospital", windowStart: "2026-01-01", windowEnd: "2026-12-31", ...over });
  const txn = (over: Partial<ErpTransaction>): ErpTransaction => ({ sourceKey: "K1", system: "SYN", docType: "bill", docNo: "1", lineNo: null, line: "freight_customs", amount: 10, currency: "JOD", fxRate: null, vatIncluded: false, vatRate: 0.16, date: "2026-06-01", contractNo: null, tenderNo: null, projectRef: null, invoiceNo: null, serial: null, poNo: null, customerRef: null, customerName: null, ...over });
  it("a stable identifier that points to one deal is exact", () => {
    const m = matchTransaction(txn({ contractNo: "c 100" }), [ids({}), ids({ dealId: "B", contractNo: "C-200", projectRefs: [], invoiceNos: [], serials: [], poNos: [], tenderNo: null })]);
    expect(m.confidence).toBe("exact");
    expect(m.dealId).toBe("A");
  });
  it("identifiers that point to two deals are ambiguous: low confidence, no deal chosen", () => {
    const m = matchTransaction(txn({ contractNo: "C-100", projectRef: "PRJ-2" }), [ids({}), ids({ dealId: "B", contractNo: "C-200", projectRefs: ["PRJ-2"], tenderNo: null, invoiceNos: [], serials: [], poNos: [] })]);
    expect(m.dealId).toBeNull();
    expect(m.confidence).toBe("low");
    expect(m.candidates).toEqual(["A", "B"]);
  });
  it("customer plus date is high; customer alone is medium; nothing is low and unassigned", () => {
    expect(matchTransaction(txn({ customerRef: "CUST-1" }), [ids({})]).confidence).toBe("high");
    expect(matchTransaction(txn({ customerRef: "CUST-1", date: "2027-02-01" }), [ids({})]).confidence).toBe("medium");
    const none = matchTransaction(txn({}), [ids({})]);
    expect(none.dealId).toBeNull();
    expect(none.confidence).toBe("low");
  });
  it("a medium match is held out of verified profit until a person confirms it", () => {
    const deal: Deal = { ...DEAL_A, id: "A" };
    const m = matchTransaction(txn({ customerName: "Synthetic Hospital", date: "2027-03-01" }), [ids({})]);
    expect(m.confidence).toBe("medium");
    const e = entry("A", "freight_customs", 10, { confidence: m.confidence, review: "pending" });
    expect(classify(deal, [e]).heldOut[0].reason).toBe("pending_review");
    expect(classify(deal, [{ ...e, review: "confirmed" }]).counted).toHaveLength(1);
  });
});

describe("duplicate imports are idempotent", () => {
  it("re-importing the same entries changes nothing", () => {
    const first = mergeImport([], ENTRIES_B);
    expect(first.inserted).toBe(ENTRIES_B.length);
    const second = mergeImport(first.entries, ENTRIES_B);
    expect(second).toMatchObject({ inserted: 0, updated: 0, unchanged: ENTRIES_B.length });
    expect(second.entries).toHaveLength(ENTRIES_B.length);
  });
  it("a corrected amount updates the figure but keeps a person's decision and the deal", () => {
    const base = entry("A", "installation", 100, { id: "m1", sourceKey: "S1", review: "confirmed", confidence: "medium" });
    const r = mergeImport([base], [{ ...base, amount: 120, review: "pending", confidence: "exact" }]);
    expect(r.updated).toBe(1);
    expect(r.decisionsKept).toBe(1);
    expect(r.entries[0]).toMatchObject({ amount: 120, review: "confirmed", confidence: "medium" });
  });
  it("one file listing the same transaction twice counts it once", () => {
    const e = entry("A", "other", 5, { sourceKey: "DUP" });
    expect(mergeImport([], [e, { ...e, id: "second" }]).inserted).toBe(1);
  });
});

describe("pre-bid simulation", () => {
  const inputs: SimInputs = { price: 100000, discountPct: 2, supplierCost: 70000, freightCustoms: 2500, installation: 3000, warrantyProvision: 1500, commissionPct: 2, paymentDays: 90, financingRateAnnualPct: 9, rebate: 2000, rebateEligibleAndEarned: false };
  it("works the margin out from the formula", () => {
    const r = simulate(inputs);
    expect(fromFils(r.netRevenue)).toBe(98000);
    expect(fromFils(r.commission)).toBe(1960);
    expect(fromFils(r.financing)).toBeCloseTo(98000 * 0.09 * 90 / 365, 3);
    expect(fromFils(r.rebateUsed)).toBe(0);
    expect(r.caveats.some((c) => c.includes("not counted"))).toBe(true);
  });
  it("counts a rebate only when eligible and earned", () => {
    expect(simulate({ ...inputs, rebateEligibleAndEarned: true }).contribution - simulate(inputs).contribution).toBe(toFils(2000));
  });
  it("the minimum price reaches the target margin and a price 1 JOD lower does not", () => {
    const target = 15;
    const { price } = minimumPrice(inputs, target);
    expect(price).not.toBeNull();
    const at = simulate({ ...inputs, price: price as number });
    expect(at.contribution / at.netRevenue).toBeGreaterThanOrEqual(target / 100 - 1e-6);
    const lower = simulate({ ...inputs, price: (price as number) - 1 });
    expect(lower.contribution / lower.netRevenue).toBeLessThan(target / 100);
  });
  it("gives no minimum price when assumptions are incomplete, no target is set, or the target is unreachable", () => {
    expect(minimumPrice({ ...inputs, installation: 0 }, 15).price).toBeNull();
    expect(minimumPrice({ ...inputs, financingRateAnnualPct: null }, 15).price).toBeNull();
    expect(minimumPrice(inputs, null).reason).toMatch(/not set/);
    expect(minimumPrice({ ...inputs, commissionPct: 90 }, 15).price).toBeNull();
  });
  it("sensitivities list every assumption, worst first, and never mutate the inputs", () => {
    const frozen = JSON.stringify(inputs);
    const out = runSimulation(inputs, 15);
    expect(out.sensitivities).toHaveLength(9);
    expect(out.sensitivities[0].contributionDelta).toBeLessThanOrEqual(out.sensitivities.at(-1)!.contributionDelta);
    expect(JSON.stringify(inputs)).toBe(frozen);
  });
  it("a simulation shares no state with deal analysis: running it leaves a deal's ledger untouched", () => {
    const before = JSON.stringify(ENTRIES_A);
    runSimulation(inputs, 15);
    expect(JSON.stringify(ENTRIES_A)).toBe(before);
  });
});

describe("verified outcome tracking", () => {
  const base = { findingKey: "B:freight_overrun", takenOn: "2026-11-01", marginPct: 11.8, impactJod: 5500, contributionJod: 23500 };
  it("resolved when the rule no longer fires", () => {
    expect(verifyOutcome(base, { marginPct: 14, contributionJod: 28000, impactJod: null })).toMatchObject({ verdict: "resolved", profitRecoveredJod: 4500, marginChangePp: 2.2 });
  });
  it("improved, unchanged or worsened by the finding's impact", () => {
    expect(verifyOutcome(base, { marginPct: 12.5, contributionJod: 25000, impactJod: 4000 }).verdict).toBe("improved");
    expect(verifyOutcome(base, { marginPct: 11.8, contributionJod: 23500, impactJod: 5500 }).verdict).toBe("no_change");
    expect(verifyOutcome(base, { marginPct: 10, contributionJod: 20000, impactJod: 7000 }).verdict).toBe("worsened");
  });
});
