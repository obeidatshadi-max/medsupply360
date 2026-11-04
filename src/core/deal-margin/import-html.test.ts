import { describe, expect, it } from "vitest";
import { analyseDeal, type DealIdentifiers } from "./index";
import { DEAL_A, DEAL_B, DEAL_C, ENTRIES_A, ENTRIES_B, ENTRIES_C, REBATES_A, REBATES_C, SYNTHETIC_POLICY } from "./fixtures";
import { cleanDealForm, cleanEntryForm, cleanPolicyForm, cleanRebateForm } from "./forms";
import { dealCardsHtml, dealTabsHtml, esc, findingsHtml, heldOutHtml, portfolioHtml, rebatesHtml, simulationHtml, varianceHtml } from "./html";
import { matchCosts, parseCostFile } from "./import";
import { analysePortfolio } from "./index";

const TODAY = "2026-11-04";
const B = () => analyseDeal({ deal: DEAL_B, entries: ENTRIES_B, rebates: [] }, SYNTHETIC_POLICY, TODAY);

const HEAD = "transaction id,document type,document no,cost line,amount,currency,fx rate,vat included,date,contract no,project ref,customer ref,status";
const ids: DealIdentifiers = { dealId: "B", contractNo: "C-900", tenderNo: null, projectRefs: ["PRJ-9"], invoiceNos: [], serials: [], poNos: [], customerRef: "SYN-H-1", customerName: "Synthetic Hospital", windowStart: "2026-01-01", windowEnd: "2026-12-31" };

describe("cost file reading", () => {
  it("reads rows, converts, and matches exactly by contract number", () => {
    const p = parseCostFile(`${HEAD}\nT1,bill,F-1,freight,9500,JOD,,no,2026-06-01,C-900,,,\nT2,bill,U-1,product cost,1000,USD,0.709,no,2026-06-02,,PRJ-9,,estimated`);
    expect(p.errors).toEqual([]);
    expect(p.transactions).toHaveLength(2);
    expect(p.transactions[1]).toMatchObject({ line: "acquisition", currency: "USD", fxRate: 0.709 });
    const m = matchCosts(p, [ids]);
    expect(m.exact).toBe(2);
    expect(m.entries.map((e) => e.status)).toEqual(["actual", "estimated"]);
    expect(m.entries[0]).toMatchObject({ dealId: "B", confidence: "exact", review: "confirmed", sourceKey: "T1" });
  });
  it("sends a customer-only match to review and lists an unmatched row without saving it", () => {
    const p = parseCostFile(`${HEAD}\nT3,bill,F-3,installation,500,JOD,,no,2026-06-01,,,SYN-H-1,\nT4,bill,F-4,installation,700,JOD,,no,2026-06-01,,,OTHER,`);
    const m = matchCosts(p, [ids]);
    expect(m.entries).toHaveLength(1);
    expect(m.entries[0]).toMatchObject({ confidence: "high", review: "pending" });
    expect(m.needReview).toBe(1);
    expect(m.unmatched).toHaveLength(1);
  });
  it("rejects bad rows with their line number and a reason, and keeps the good ones", () => {
    const p = parseCostFile(`${HEAD}\nT5,bill,F-5,teleportation,10,JOD,,no,2026-06-01,C-900,,,\nT6,bill,F-6,freight,abc,JOD,,no,2026-06-01,C-900,,,\nT7,bill,F-7,freight,10,USD,,no,2026-06-01,C-900,,,\nT8,bill,F-8,freight,10,JOD,,no,01/06/2026,C-900,,,\n,bill,,freight,10,JOD,,no,2026-06-01,C-900,,,\nT9,bill,F-9,freight,10,JOD,,no,2026-06-01,C-900,,,`);
    expect(p.errors.map((e) => e.row)).toEqual([2, 3, 5, 6]);
    expect(p.transactions.map((t) => t.sourceKey)).toEqual(["T7", "T9"]);
  });
  it("a foreign-currency row without a rate is read but later held out of the margin", () => {
    const p = parseCostFile(`${HEAD}\nT7,bill,F-7,freight,10,USD,,no,2026-06-01,C-900,,,`);
    expect(p.transactions[0].fxRate).toBeNull();
  });
  it("the same transaction twice in one file is counted once", () => {
    const p = parseCostFile(`${HEAD}\nT1,bill,F-1,freight,10,JOD,,no,,C-900,,,\nT1,bill,F-1,freight,10,JOD,,no,,C-900,,,`);
    expect(p.transactions).toHaveLength(1);
    expect(p.errors).toHaveLength(1);
  });
  it("needs the cost line and amount columns, understands semicolons and Arabic headings", () => {
    expect(parseCostFile("a,b\n1,2").errors.length).toBe(2);
    const p = parseCostFile("رقم المستند;البند;المبلغ\nD-1;شحن;100\n");
    expect(p.errors).toEqual([]);
    expect(p.transactions[0]).toMatchObject({ line: "freight_customs", amount: 100, docNo: "D-1" });
  });
});

describe("form cleaning", () => {
  const entry = { line: "freight_customs", amount: "9,500", currency: "JOD", fxRate: "", vatIncluded: "", vatRate: "16", status: "actual", provision: "", docType: "bill", docNo: "F-1", sourceKey: "", coveredBy: "", incurredOn: "2026-06-01", note: "" };
  it("accepts a clean entry and gives it a stable source key from the document", () => {
    const r = cleanEntryForm(entry);
    expect(r).toMatchObject({ ok: true, value: { amount: 9500, sourceKey: "manual:bill:F-1:freight_customs" } });
  });
  it("refuses unclear entries, naming what to fix", () => {
    for (const bad of [{ line: "x" }, { amount: "" }, { amount: "1.2.3" }, { currency: "usd1" }, { currency: "USD" }, { status: "maybe" }, { provision: "on" }, { coveredBy: "freight_customs" }, { incurredOn: "01/06/2026" }]) {
      const r = cleanEntryForm({ ...entry, ...bad });
      expect(r.ok, JSON.stringify(bad)).toBe(false);
    }
  });
  it("a rebate that is earned, accrued or received needs evidence", () => {
    const base = { supplier: "Synthetic Supplier", amount: "100", currency: "JOD", fxRate: "", status: "earned", evidenceRef: "", creditNoteRef: "" };
    expect(cleanRebateForm(base).ok).toBe(false);
    expect(cleanRebateForm({ ...base, evidenceRef: "STMT" }).ok).toBe(true);
    expect(cleanRebateForm({ ...base, status: "contractual" }).ok).toBe(true);
  });
  it("thresholds are percentages or empty", () => {
    const empty = { minContributionMarginPct: "", maxDiscountPct: "", costOverrunTolerancePct: "", deteriorationPp: "", financingRateAnnualPct: "", roundingToleranceFils: "" };
    expect(cleanPolicyForm(empty)).toMatchObject({ ok: true, value: { minContributionMarginPct: null, roundingToleranceFils: 1 } });
    expect(cleanPolicyForm({ ...empty, maxDiscountPct: "101" }).ok).toBe(false);
    expect(cleanPolicyForm({ ...empty, roundingToleranceFils: "1.5" }).ok).toBe(false);
  });
  it("a deal needs a product cost so a margin can be worked out", () => {
    const form = { kind: "tender", ref: "R-1", title: "Deal title", customerName: "Cust", customerRef: "", contractPrice: "100", quoteDiscount: "", quoteAcquisition: "", quoteFreightCustoms: "", quoteInstallation: "", quoteWarranty: "", quoteCommission: "", quoteFinancing: "", quoteOther: "", quoteRebate: "", warrantyMonths: "", hasInstallation: "", deliveredPct: "", installedPct: "", receivableOutstanding: "", collectionDaysLate: "", warrantyOpen: "", serviceOpen: "", contractNo: "", tenderNo: "", projectRefs: "p1, p2;p1", invoiceNos: "", serials: "", poNos: "", windowStart: "", windowEnd: "" };
    expect(cleanDealForm(form).ok).toBe(false);
    const ok = cleanDealForm({ ...form, quoteAcquisition: "60" });
    expect(ok).toMatchObject({ ok: true, value: { identifiers: { projectRefs: ["p1", "p2"] }, obligations: { installedPct: null } } });
  });
});

describe("presentation is safe and honest", () => {
  it("escapes every special character", () => {
    expect(esc(`<img src=x onerror="a">'&`)).toBe("&lt;img src=x onerror=&quot;a&quot;&gt;&#39;&amp;");
  });
  it("hostile names and notes never reach the page as markup", () => {
    const evil = `<script>alert(1)</script>`;
    const deal = { ...DEAL_B, title: evil, customerName: evil };
    const entries = ENTRIES_B.map((e) => ({ ...e, note: evil, source: { system: evil, docType: evil, docNo: evil } }));
    const a = analyseDeal({ deal, entries, rebates: [] }, SYNTHETIC_POLICY, TODAY);
    const html = [dealCardsHtml(a), dealTabsHtml(a, entries), varianceHtml(a), rebatesHtml(a), heldOutHtml(a), findingsHtml(a.findings)].join("");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
  it("the tab block has three panes; the forecast is visible first; every step has its words label", () => {
    const html = dealTabsHtml(B(), ENTRIES_B);
    expect((html.match(/data-dm-pane=/g) ?? []).length).toBe(3);
    expect(html).toMatch(/data-dm-pane="quoted" hidden/);
    expect(html).not.toMatch(/data-dm-pane="forecast"[^>]* hidden/);
    expect(html).toContain("Actual + estimate");
    expect(html).toContain("Reconciled");
  });
  it("lists the source records behind a step", () => {
    expect(dealTabsHtml(B(), ENTRIES_B)).toContain("source records: open to see each");
  });
  it("says plainly when a rebate is only promised and when a credit has no proof", () => {
    const c = analyseDeal({ deal: DEAL_C, entries: ENTRIES_C, rebates: REBATES_C }, SYNTHETIC_POLICY, TODAY);
    const html = rebatesHtml(c);
    expect(html).toContain("Never added to profit");
    expect(html).toContain("no supplier credit note or receipt number");
  });
  it("the portfolio shows 'threshold not set' instead of an invented zero", () => {
    const { portfolio } = analysePortfolio([{ deal: DEAL_A, entries: ENTRIES_A, rebates: REBATES_A }], { ...SYNTHETIC_POLICY, minContributionMarginPct: null }, TODAY);
    expect(portfolioHtml(portfolio, { ...SYNTHETIC_POLICY, minContributionMarginPct: null })).toContain("threshold not set");
  });
  it("simulation output is the same text for the same inputs (reproducible)", () => {
    const i = { price: 100000, discountPct: 2, supplierCost: 70000, freightCustoms: 2500, installation: 3000, warrantyProvision: 1500, commissionPct: 2, paymentDays: 90, financingRateAnnualPct: 9, rebate: 0, rebateEligibleAndEarned: false };
    expect(simulationHtml(i, 15)).toBe(simulationHtml(i, 15));
    expect(simulationHtml(i, 15)).toContain("Minimum selling price");
    expect(simulationHtml(i, null)).toContain("not set");
  });
});
