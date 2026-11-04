/**
 * Deal margins against a real Postgres engine (PGlite) with the real migrations: tenant isolation, one transaction counted
 * once, idempotent re-import, review decisions, rebates, and verified outcome tracking. Synthetic data only.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import type { Db } from "@/db/import-writer";
import { analyseDeal, analysePortfolio, fromFils, type LedgerEntry } from "@/core/deal-margin";
import { SYNTHETIC_POLICY, entry } from "@/core/deal-margin/fixtures";
import type { DealForm, EntryForm, RebateForm } from "@/core/deal-margin/forms";
import { canEditDealMargin, canSeeDealMargin, canSimulateDeal, ROLES } from "@/core/permissions";
import { addEntry, addRebate, checkOutcomes, createDeal, importEntries, loadDealInput, loadDealInputs, loadOutcomes, loadPolicy, reviewEntry, savePolicy, startAction } from "@/server/services/deal-margin";

let client: PGlite;
let db: Db;
let a: string;
let b: string;
const q = async <T>(sql: string) => (await client.query<T>(sql)).rows;

const dealForm = (over: Partial<DealForm> = {}): DealForm => ({
  kind: "tender", ref: "SYN-T-900", title: "Imaging system, synthetic tender", customerName: "Synthetic Hospital", customerRef: "SYN-H-1", contractPrice: "200,000",
  quoteDiscount: "", quoteAcquisition: "140,000", quoteFreightCustoms: "4,000", quoteInstallation: "6,000", quoteWarranty: "3,000", quoteCommission: "4,000", quoteFinancing: "1,000", quoteOther: "", quoteRebate: "",
  warrantyMonths: "24", hasInstallation: "on", deliveredPct: "100", installedPct: "70", receivableOutstanding: "60,000", collectionDaysLate: "90", warrantyOpen: "on", serviceOpen: "",
  contractNo: "C-900", tenderNo: "", projectRefs: "PRJ-9", invoiceNos: "", serials: "", poNos: "", windowStart: "2026-01-01", windowEnd: "2026-12-31", ...over,
});
const entryForm = (over: Partial<EntryForm> = {}): EntryForm => ({ line: "freight_customs", amount: "9,500", currency: "JOD", fxRate: "", vatIncluded: "", vatRate: "16", status: "actual", provision: "", docType: "bill", docNo: "F-1", sourceKey: "", coveredBy: "", incurredOn: "2026-06-01", note: "", ...over });
const rebateForm = (over: Partial<RebateForm> = {}): RebateForm => ({ supplier: "Synthetic Supplier", amount: "2,000", currency: "JOD", fxRate: "", status: "earned", evidenceRef: "STMT-1", creditNoteRef: "", ...over });

async function newDeal(company: string, over: Partial<DealForm> = {}) {
  const r = await createDeal(db, { companyId: company, form: dealForm(over), by: "Sami Nasser" });
  if (!r.ok) throw new Error(r.error);
  return r.id;
}

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client, { schema }) as unknown as Db;
  const dir = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(dir + f, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) await client.exec(stmt);
  }
  a = (await q<{ id: string }>(`insert into companies (slug, name) values ('a', 'A') returning id`))[0]!.id;
  b = (await q<{ id: string }>(`insert into companies (slug, name) values ('b', 'B') returning id`))[0]!.id;
}, 60_000);
afterAll(async () => client.close());

describe("access by role", () => {
  it("only owner and administrator read or simulate; only the owner edits", () => {
    expect(ROLES.filter(canSeeDealMargin)).toEqual(["owner", "admin"]);
    expect(ROLES.filter(canSimulateDeal)).toEqual(["owner", "admin"]);
    expect(ROLES.filter(canEditDealMargin)).toEqual(["owner"]);
  });
});

describe("deals and the ledger", () => {
  it("creates a deal and reads it back with the quote and obligations", async () => {
    const id = await newDeal(a);
    const di = await loadDealInput(db, a, id);
    expect(di?.deal).toMatchObject({ ref: "SYN-T-900", contractPrice: 200000, warrantyMonths: 24, hasInstallation: true });
    expect(di?.deal.quote.costs.acquisition).toBe(140000);
    expect(di?.deal.obligations).toMatchObject({ deliveredPct: 100, installedPct: 70, receivableOutstanding: 60000, warrantyOpen: true });
  });

  it("refuses an invalid deal and a repeated reference", async () => {
    expect((await createDeal(db, { companyId: a, form: dealForm({ contractPrice: "abc", ref: "SYN-T-901" }), by: "X Y" })).ok).toBe(false);
    expect((await createDeal(db, { companyId: a, form: dealForm({ quoteAcquisition: "" , ref: "SYN-T-902" }), by: "X Y" })).ok).toBe(false);
    const dup = await createDeal(db, { companyId: a, form: dealForm(), by: "X Y" });
    expect(dup.ok).toBe(false);
  });

  it("keeps companies apart: another company sees nothing and cannot write into this deal", async () => {
    const id = await newDeal(a, { ref: "SYN-T-910" });
    expect(await loadDealInput(db, b, id)).toBeNull();
    expect(await loadDealInputs(db, b)).toEqual([]);
    const r = await addEntry(db, { companyId: b, dealId: id, form: entryForm({ docNo: "X-1" }), by: "Evil Eve" });
    expect(r.ok).toBe(false);
    expect(await addRebate(db, { companyId: b, dealId: id, form: rebateForm(), by: "Evil Eve" })).toMatchObject({ ok: false });
    expect((await loadDealInput(db, a, id))!.entries).toHaveLength(0);
  });

  it("the same transaction cannot be added twice, in this deal or another", async () => {
    const d1 = await newDeal(a, { ref: "SYN-T-920" });
    const d2 = await newDeal(a, { ref: "SYN-T-921" });
    expect((await addEntry(db, { companyId: a, dealId: d1, form: entryForm({ docNo: "DUP-1" }), by: "S N" })).ok).toBe(true);
    expect((await addEntry(db, { companyId: a, dealId: d1, form: entryForm({ docNo: "DUP-1" }), by: "S N" })).ok).toBe(false);
    expect((await addEntry(db, { companyId: a, dealId: d2, form: entryForm({ docNo: "DUP-1" }), by: "S N" })).ok).toBe(false);
  });

  it("the database itself refuses a second row with the same source key", async () => {
    const d = await newDeal(a, { ref: "SYN-T-922" });
    const ins = (n: number) => client.query(`insert into deal_cost_entries (company_id, deal_id, line, amount, source_key) values ('${a}', '${d}', 'other', ${n}, 'RAW-1')`);
    await ins(1);
    await expect(ins(2)).rejects.toThrow();
  });

  it("converts a foreign currency only with a rate, and keeps the rate on the entry", async () => {
    const d = await newDeal(a, { ref: "SYN-T-930" });
    expect((await addEntry(db, { companyId: a, dealId: d, form: entryForm({ currency: "USD", fxRate: "", docNo: "U-1" }), by: "S N" })).ok).toBe(false);
    expect((await addEntry(db, { companyId: a, dealId: d, form: entryForm({ line: "acquisition", currency: "USD", fxRate: "0.709", amount: "1,000", docNo: "U-2" }), by: "S N" })).ok).toBe(true);
    const di = (await loadDealInput(db, a, d))!;
    expect(fromFils(analyseDeal(di, SYNTHETIC_POLICY, "2026-11-04").views.forecast.lines.acquisition.fils)).toBe(709);
  });
});

describe("importing ERP entries", () => {
  const erp = (dealId: string, key: string, over: Partial<LedgerEntry> = {}): LedgerEntry => entry(dealId, "installation", 3000, { id: `erp:${key}`, sourceKey: key, ...over });

  it("is idempotent: a second import of the same file changes nothing", async () => {
    const d = await newDeal(a, { ref: "SYN-T-940" });
    const rows = [erp(d, "K-1"), erp(d, "K-2", { line: "freight_customs" })];
    expect(await importEntries(db, { companyId: a, entries: rows, by: "import" })).toMatchObject({ inserted: 2, updated: 0, unchanged: 0 });
    expect(await importEntries(db, { companyId: a, entries: rows, by: "import" })).toMatchObject({ inserted: 0, updated: 0, unchanged: 2 });
    expect((await loadDealInput(db, a, d))!.entries).toHaveLength(2);
  });

  it("a corrected amount updates the figure and keeps a person's decision", async () => {
    const d = await newDeal(a, { ref: "SYN-T-941" });
    await importEntries(db, { companyId: a, entries: [erp(d, "K-10", { confidence: "medium", review: "pending" })], by: "import" });
    const id = (await loadDealInput(db, a, d))!.entries[0].id;
    expect((await reviewEntry(db, { companyId: a, entryId: id, decision: "confirmed", by: "Sami Nasser" })).ok).toBe(true);
    const r = await importEntries(db, { companyId: a, entries: [erp(d, "K-10", { amount: 3200, confidence: "medium", review: "pending" })], by: "import" });
    expect(r).toMatchObject({ updated: 1, decisionsKept: 1 });
    expect((await loadDealInput(db, a, d))!.entries[0]).toMatchObject({ amount: 3200, review: "confirmed" });
  });

  it("refuses entries aimed at another company's deal", async () => {
    const mine = await newDeal(a, { ref: "SYN-T-942" });
    const theirs = await newDeal(b, { ref: "SYN-T-942" });
    const r = await importEntries(db, { companyId: a, entries: [erp(theirs, "K-20"), erp(mine, "K-21")], by: "import" });
    expect(r).toMatchObject({ inserted: 1, refused: 1 });
    expect((await loadDealInput(db, b, theirs))!.entries).toHaveLength(0);
  });

  it("an unconfirmed match stays out of verified profit until a person confirms it, and rejection removes it", async () => {
    const d = await newDeal(a, { ref: "SYN-T-943" });
    await importEntries(db, { companyId: a, entries: [erp(d, "K-30", { line: "freight_customs", amount: 9500, confidence: "medium", review: "pending" })], by: "import" });
    const policy = await loadPolicy(db, a);
    const before = analyseDeal((await loadDealInput(db, a, d))!, policy, "2026-11-04");
    expect(before.views.forecast.lines.freight_customs.basis).toBe("from_quote");
    const id = (await loadDealInput(db, a, d))!.entries[0].id;
    await reviewEntry(db, { companyId: a, entryId: id, decision: "confirmed", by: "Sami Nasser" });
    expect(analyseDeal((await loadDealInput(db, a, d))!, policy, "2026-11-04").views.forecast.lines.freight_customs.basis).toBe("actual");
    await reviewEntry(db, { companyId: a, entryId: id, decision: "rejected", by: "Sami Nasser" });
    expect(analyseDeal((await loadDealInput(db, a, d))!, policy, "2026-11-04").views.forecast.lines.freight_customs.basis).toBe("from_quote");
  });

  it("moving an entry only works to a deal of the same company", async () => {
    const d = await newDeal(a, { ref: "SYN-T-944" });
    const other = await newDeal(b, { ref: "SYN-T-944" });
    await importEntries(db, { companyId: a, entries: [erp(d, "K-40", { confidence: "low", review: "pending" })], by: "import" });
    const id = (await loadDealInput(db, a, d))!.entries[0].id;
    expect(await reviewEntry(db, { companyId: a, entryId: id, decision: "confirmed", moveToDealId: other, by: "S N" })).toMatchObject({ ok: false });
  });
});

describe("rebates", () => {
  it("an earned rebate needs evidence; a contractual one counts for nothing", async () => {
    const d = await newDeal(a, { ref: "SYN-T-950" });
    expect((await addRebate(db, { companyId: a, dealId: d, form: rebateForm({ evidenceRef: "" }), by: "S N" })).ok).toBe(false);
    expect((await addRebate(db, { companyId: a, dealId: d, form: rebateForm({ status: "contractual", amount: "6,000", evidenceRef: "" }), by: "S N" })).ok).toBe(true);
    expect((await addRebate(db, { companyId: a, dealId: d, form: rebateForm({ status: "received", amount: "1,000", creditNoteRef: "CN-1" }), by: "S N" })).ok).toBe(true);
    const f = analyseDeal((await loadDealInput(db, a, d))!, await loadPolicy(db, a), "2026-11-04").views.forecast.rebates;
    expect(fromFils(f.verified)).toBe(1000);
    expect(fromFils(f.potential)).toBe(6000);
  });
});

describe("approved thresholds", () => {
  it("are empty until the company sets them, then drive the rules", async () => {
    expect((await loadPolicy(db, a)).minContributionMarginPct).toBeNull();
    const ok = await savePolicy(db, { companyId: a, by: "Sami Nasser", form: { minContributionMarginPct: "15", maxDiscountPct: "5", costOverrunTolerancePct: "10", deteriorationPp: "3", financingRateAnnualPct: "9", roundingToleranceFils: "1" } });
    expect(ok.ok).toBe(true);
    expect(await loadPolicy(db, a)).toMatchObject({ minContributionMarginPct: 15, financingRateAnnualPct: 9 });
    expect((await loadPolicy(db, b)).minContributionMarginPct).toBeNull();
    expect((await savePolicy(db, { companyId: a, by: "X Y", form: { minContributionMarginPct: "150", maxDiscountPct: "", costOverrunTolerancePct: "", deteriorationPp: "", financingRateAnnualPct: "", roundingToleranceFils: "1" } })).ok).toBe(false);
  });
});

describe("portfolio over the database and verified outcomes", () => {
  it("analyses every deal of a company without counting a transaction twice", async () => {
    const { portfolio } = analysePortfolio(await loadDealInputs(db, a), await loadPolicy(db, a), "2026-11-04");
    expect(portfolio.analysed).toBeGreaterThan(5);
    expect(portfolio.segments.map((s) => s.kind)).toEqual(["tender", "private"]);
  });

  it("starts an action from a finding, then verifies the outcome from the recalculated numbers", async () => {
    const d = await newDeal(a, { ref: "SYN-T-960" });
    await importEntries(db, { companyId: a, entries: [entry(d, "acquisition", 140000, { id: "e1", sourceKey: "O-1" }), entry(d, "freight_customs", 9500, { id: "e2", sourceKey: "O-2" })], by: "import" });
    const policy = await loadPolicy(db, a);
    const analysis = analyseDeal((await loadDealInput(db, a, d))!, policy, "2026-11-04");
    const finding = analysis.findings.find((f) => f.rule === "freight_overrun")!;
    expect(finding).toBeTruthy();
    const started = await startAction(db, { companyId: a, dealId: d, finding, analysis, title: "Query the forwarder invoice", due: "2026-12-01", today: "2026-11-04", by: "Sami Nasser" });
    expect(started.ok).toBe(true);
    expect((await startAction(db, { companyId: a, dealId: d, finding, analysis, title: "again", due: "2026-12-01", today: "2026-11-04", by: "S N" })).ok).toBe(false);
    expect((await q<{ n: number }>(`select count(*)::int as n from management_actions where company_id = '${a}' and title = 'Query the forwarder invoice'`))[0]!.n).toBe(1);

    // Nothing changed yet: the check says so. A person marking the action done proves nothing by itself.
    await checkOutcomes(db, { companyId: a, dealId: d, today: "2026-11-10" });
    expect((await loadOutcomes(db, a, d))[0].verdict).toBe("no_change");

    // A supplier credit note brings freight back to the quote: the finding disappears.
    await importEntries(db, { companyId: a, entries: [entry(d, "freight_customs", -5500, { id: "e3", sourceKey: "O-3", note: "forwarder credit note" })], by: "import" });
    await checkOutcomes(db, { companyId: a, dealId: d, today: "2026-11-20" });
    const outcome = (await loadOutcomes(db, a, d))[0];
    expect(outcome.verdict).toBe("resolved");
    expect(outcome.profitRecoveredJod).toBe(5500);
    expect((await loadOutcomes(db, b, d))).toEqual([]);
  });
});
