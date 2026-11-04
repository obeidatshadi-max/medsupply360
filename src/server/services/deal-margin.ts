import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/import-writer";
import { dealActionOutcomes, dealCostEntries, dealRebates, deals, managementActions, marginPolicies } from "@/db/schema";
import {
  COST_CATEGORIES,
  EMPTY_POLICY,
  analyseDeal,
  mergeImport,
  verifyOutcome,
  type Deal,
  type DealAnalysis,
  type DealIdentifiers,
  type DealInput,
  type Finding,
  type LedgerEntry,
  type MarginPolicy,
  type RebateEntry,
} from "@/core/deal-margin";
import { cleanDealForm, cleanEntryForm, cleanPolicyForm, cleanRebateForm, type DealForm, type EntryForm, type PolicyForm, type RebateForm } from "@/core/deal-margin/forms";
import { isUuid } from "@/core/sales-force";

export type Outcome = { ok: true; id: string } | { ok: false; error: string };
const NOT_FOUND = "That deal was not found.";
const num = (v: string | number | null): number => (v === null ? 0 : Number(v));

type DealRow = typeof deals.$inferSelect;
type EntryRow = typeof dealCostEntries.$inferSelect;
type RebateRow = typeof dealRebates.$inferSelect;

export function toDeal(r: DealRow): Deal {
  const costs = Object.fromEntries(COST_CATEGORIES.map((c) => [c, Number(r.quote.costs[c] ?? 0)])) as Deal["quote"]["costs"];
  return {
    id: r.id,
    kind: r.kind,
    ref: r.ref,
    title: r.title,
    customerName: r.customerName,
    customerRef: r.customerRef,
    contractPrice: num(r.contractPrice),
    quote: { price: Number(r.quote.price), discount: Number(r.quote.discount), costs, assumedRebate: Number(r.quote.assumedRebate) },
    obligations: r.obligations,
    warrantyMonths: r.warrantyMonths,
    hasInstallation: r.hasInstallation,
    collectionDaysLate: r.collectionDaysLate,
    synthetic: false,
  };
}

export function toEntry(r: EntryRow): LedgerEntry {
  return {
    id: r.id,
    dealId: r.dealId,
    line: r.line,
    amount: num(r.amount),
    currency: r.currency,
    fxRate: r.fxRate === null ? null : Number(r.fxRate),
    vatIncluded: r.vatIncluded,
    vatRate: Number(r.vatRate),
    status: r.status,
    provision: r.provision,
    source: r.sourceDocNo ? { system: r.sourceSystem ?? "", docType: r.sourceDocType ?? "", docNo: r.sourceDocNo, lineNo: r.sourceLineNo } : null,
    sourceKey: r.sourceKey,
    confidence: r.confidence,
    review: r.review,
    coveredBy: r.coveredBy === "discount" ? null : r.coveredBy,
    customerRef: r.customerRef,
    incurredOn: r.incurredOn,
    note: r.note,
  };
}

export function toRebate(r: RebateRow): RebateEntry {
  return { id: r.id, dealId: r.dealId, supplier: r.supplier, amount: num(r.amount), currency: r.currency, fxRate: r.fxRate === null ? null : Number(r.fxRate), status: r.status, evidenceRef: r.evidenceRef, creditNoteRef: r.creditNoteRef, review: r.review };
}

export async function loadPolicy(db: Db, companyId: string): Promise<MarginPolicy> {
  const [r] = await db.select().from(marginPolicies).where(eq(marginPolicies.companyId, companyId));
  if (!r) return EMPTY_POLICY;
  const n = (v: string | null) => (v === null ? null : Number(v));
  return {
    minContributionMarginPct: n(r.minContributionMarginPct),
    maxDiscountPct: n(r.maxDiscountPct),
    costOverrunTolerancePct: n(r.costOverrunTolerancePct),
    deteriorationPp: n(r.deteriorationPp),
    financingRateAnnualPct: n(r.financingRateAnnualPct),
    roundingToleranceFils: r.roundingToleranceFils,
  };
}

export async function savePolicy(db: Db, input: { companyId: string; form: PolicyForm; by: string }): Promise<Outcome> {
  const c = cleanPolicyForm(input.form);
  if (!c.ok) return c;
  const v = c.value;
  const s = (x: number | null) => (x === null ? null : String(x));
  const values = { minContributionMarginPct: s(v.minContributionMarginPct), maxDiscountPct: s(v.maxDiscountPct), costOverrunTolerancePct: s(v.costOverrunTolerancePct), deteriorationPp: s(v.deteriorationPp), financingRateAnnualPct: s(v.financingRateAnnualPct), roundingToleranceFils: v.roundingToleranceFils, updatedBy: input.by, updatedAt: sql`now()` };
  await db.insert(marginPolicies).values({ companyId: input.companyId, ...values }).onConflictDoUpdate({ target: marginPolicies.companyId, set: values });
  return { ok: true, id: input.companyId };
}

/** Every deal of ONE company with its ledger and rebates. Never reads another company's rows. */
export async function loadDealInputs(db: Db, companyId: string): Promise<DealInput[]> {
  const [dealRows, entryRows, rebateRows] = await Promise.all([
    db.select().from(deals).where(eq(deals.companyId, companyId)).orderBy(asc(deals.createdAt)),
    db.select().from(dealCostEntries).where(eq(dealCostEntries.companyId, companyId)).orderBy(asc(dealCostEntries.incurredOn), asc(dealCostEntries.createdAt)),
    db.select().from(dealRebates).where(eq(dealRebates.companyId, companyId)),
  ]);
  return dealRows.map((d) => ({ deal: toDeal(d), entries: entryRows.filter((e) => e.dealId === d.id).map(toEntry), rebates: rebateRows.filter((r) => r.dealId === d.id).map(toRebate) }));
}

export async function loadDealInput(db: Db, companyId: string, id: string): Promise<DealInput | null> {
  if (!isUuid(id)) return null;
  const [d] = await db.select().from(deals).where(and(eq(deals.companyId, companyId), eq(deals.id, id)));
  if (!d) return null;
  const [entryRows, rebateRows] = await Promise.all([
    db.select().from(dealCostEntries).where(and(eq(dealCostEntries.companyId, companyId), eq(dealCostEntries.dealId, id))),
    db.select().from(dealRebates).where(and(eq(dealRebates.companyId, companyId), eq(dealRebates.dealId, id))),
  ]);
  return { deal: toDeal(d), entries: entryRows.map(toEntry), rebates: rebateRows.map(toRebate) };
}

/** The identifiers the ERP matcher compares transactions against, for ONE company's deals only. */
export async function loadDealIdentifiers(db: Db, companyId: string): Promise<DealIdentifiers[]> {
  const rows = await db.select().from(deals).where(eq(deals.companyId, companyId));
  return rows.map((r) => ({
    dealId: r.id,
    contractNo: r.identifiers.contractNo,
    tenderNo: r.identifiers.tenderNo,
    projectRefs: r.identifiers.projectRefs,
    invoiceNos: r.identifiers.invoiceNos,
    serials: r.identifiers.serials,
    poNos: r.identifiers.poNos,
    customerRef: r.customerRef,
    customerName: r.customerName,
    windowStart: r.windowStart,
    windowEnd: r.windowEnd,
  }));
}

export async function createDeal(db: Db, input: { companyId: string; form: DealForm; by: string }): Promise<Outcome> {
  const c = cleanDealForm(input.form);
  if (!c.ok) return c;
  const v = c.value;
  const dup = await db.select({ id: deals.id }).from(deals).where(and(eq(deals.companyId, input.companyId), eq(deals.ref, v.ref)));
  if (dup.length > 0) return { ok: false, error: `A deal with the reference ${v.ref} already exists.` };
  const [row] = await db
    .insert(deals)
    .values({
      companyId: input.companyId,
      kind: v.kind,
      ref: v.ref,
      title: v.title,
      customerName: v.customerName,
      customerRef: v.customerRef,
      contractPrice: String(v.contractPrice),
      quote: v.quote,
      obligations: v.obligations,
      warrantyMonths: v.warrantyMonths,
      hasInstallation: v.hasInstallation,
      collectionDaysLate: v.collectionDaysLate,
      identifiers: v.identifiers,
      windowStart: v.windowStart,
      windowEnd: v.windowEnd,
      createdBy: input.by,
    })
    .returning({ id: deals.id });
  return { ok: true, id: row!.id };
}

async function dealExists(db: Db, companyId: string, dealId: string): Promise<boolean> {
  if (!isUuid(dealId)) return false;
  const r = await db.select({ id: deals.id }).from(deals).where(and(eq(deals.companyId, companyId), eq(deals.id, dealId)));
  return r.length > 0;
}

/** A hand-typed ledger entry. It is a person's own entry, so it counts as confirmed; the source key is the form's, or none. */
export async function addEntry(db: Db, input: { companyId: string; dealId: string; form: EntryForm; by: string }): Promise<Outcome> {
  if (!(await dealExists(db, input.companyId, input.dealId))) return { ok: false, error: NOT_FOUND };
  const c = cleanEntryForm(input.form);
  if (!c.ok) return c;
  const v = c.value;
  if (v.sourceKey) {
    const dup = await db.select({ id: dealCostEntries.id }).from(dealCostEntries).where(and(eq(dealCostEntries.companyId, input.companyId), eq(dealCostEntries.sourceKey, v.sourceKey)));
    if (dup.length > 0) return { ok: false, error: "That transaction is already in a deal's ledger. The same transaction can be counted only once." };
  }
  const [row] = await db
    .insert(dealCostEntries)
    .values({
      companyId: input.companyId,
      dealId: input.dealId,
      line: v.line,
      amount: String(v.amount),
      currency: v.currency,
      fxRate: v.fxRate === null ? null : String(v.fxRate),
      vatIncluded: v.vatIncluded,
      vatRate: String(v.vatRate),
      status: v.status,
      provision: v.provision,
      sourceSystem: v.docNo ? "manual" : null,
      sourceDocType: v.docType,
      sourceDocNo: v.docNo,
      sourceKey: v.sourceKey,
      confidence: "exact",
      review: "confirmed",
      reviewedBy: input.by,
      coveredBy: v.coveredBy,
      incurredOn: v.incurredOn,
      note: v.note,
      createdBy: input.by,
    })
    .returning({ id: dealCostEntries.id });
  return { ok: true, id: row!.id };
}

/** A person's decision on an uncertain match: confirm it, reject it, or move it to another deal of the same company. */
export async function reviewEntry(db: Db, input: { companyId: string; entryId: string; decision: "confirmed" | "rejected"; moveToDealId?: string | null; by: string }): Promise<Outcome> {
  if (!isUuid(input.entryId)) return { ok: false, error: "That entry was not found." };
  const set: { review: "confirmed" | "rejected"; reviewedBy: string; dealId?: string } = { review: input.decision, reviewedBy: input.by };
  if (input.moveToDealId) {
    if (!(await dealExists(db, input.companyId, input.moveToDealId))) return { ok: false, error: NOT_FOUND };
    set.dealId = input.moveToDealId;
  }
  const changed = await db.update(dealCostEntries).set(set).where(and(eq(dealCostEntries.companyId, input.companyId), eq(dealCostEntries.id, input.entryId))).returning({ id: dealCostEntries.id });
  return changed.length ? { ok: true, id: input.entryId } : { ok: false, error: "That entry was not found." };
}

export async function addRebate(db: Db, input: { companyId: string; dealId: string; form: RebateForm; by: string }): Promise<Outcome> {
  if (!(await dealExists(db, input.companyId, input.dealId))) return { ok: false, error: NOT_FOUND };
  const c = cleanRebateForm(input.form);
  if (!c.ok) return c;
  const v = c.value;
  const [row] = await db
    .insert(dealRebates)
    .values({ companyId: input.companyId, dealId: input.dealId, supplier: v.supplier, amount: String(v.amount), currency: v.currency, fxRate: v.fxRate === null ? null : String(v.fxRate), status: v.status, evidenceRef: v.evidenceRef, creditNoteRef: v.creditNoteRef, createdBy: input.by })
    .returning({ id: dealRebates.id });
  return { ok: true, id: row!.id };
}

export interface ImportSummary {
  inserted: number;
  updated: number;
  unchanged: number;
  decisionsKept: number;
  /** Entries aimed at a deal that does not belong to this company. They are refused, not written. */
  refused: number;
}

/**
 * Writes matched ERP entries idempotently. An entry is identified by its source key, unique per company: a repeat import
 * leaves it alone, a corrected one takes the new figures but keeps a person's review decision and its deal.
 */
export async function importEntries(db: Db, input: { companyId: string; entries: LedgerEntry[]; batchId?: string | null; by: string }): Promise<ImportSummary> {
  const own = new Set((await db.select({ id: deals.id }).from(deals).where(eq(deals.companyId, input.companyId))).map((d) => d.id));
  const allowed = input.entries.filter((e) => own.has(e.dealId) && e.sourceKey);
  const keys = [...new Set(allowed.map((e) => e.sourceKey as string))];
  const existingRows = keys.length ? await db.select().from(dealCostEntries).where(and(eq(dealCostEntries.companyId, input.companyId), inArray(dealCostEntries.sourceKey, keys))) : [];
  const existing = existingRows.map(toEntry);
  const merged = mergeImport(existing, allowed);
  const existingIds = new Set(existing.map((e) => e.id));
  const toInsert = merged.entries.filter((e) => !existingIds.has(e.id));
  const toUpdate = merged.entries.filter((e) => existingIds.has(e.id));
  const cols = (e: LedgerEntry) => ({
    line: e.line,
    amount: String(e.amount),
    currency: e.currency,
    fxRate: e.fxRate === null ? null : String(e.fxRate),
    vatIncluded: e.vatIncluded,
    vatRate: String(e.vatRate),
    status: e.status,
    sourceSystem: e.source?.system ?? null,
    sourceDocType: e.source?.docType ?? null,
    sourceDocNo: e.source?.docNo ?? null,
    sourceLineNo: e.source?.lineNo ?? null,
    customerRef: e.customerRef,
    incurredOn: e.incurredOn,
    note: e.note,
  });
  for (const e of toInsert) {
    await db.insert(dealCostEntries).values({ companyId: input.companyId, dealId: e.dealId, sourceKey: e.sourceKey, confidence: e.confidence, review: e.review, provision: e.provision, coveredBy: e.coveredBy, importBatchId: input.batchId ?? null, createdBy: input.by, ...cols(e) });
  }
  for (const e of toUpdate) {
    const before = existing.find((x) => x.id === e.id)!;
    if (JSON.stringify(cols(before as never)) === JSON.stringify(cols(e))) continue;
    await db.update(dealCostEntries).set(cols(e)).where(and(eq(dealCostEntries.companyId, input.companyId), eq(dealCostEntries.id, e.id)));
  }
  return { inserted: merged.inserted, updated: merged.updated, unchanged: merged.unchanged, decisionsKept: merged.decisionsKept, refused: input.entries.length - allowed.length };
}

/** Starts a management action from a finding and records the numbers at that moment, so the outcome can be checked later. */
export async function startAction(
  db: Db,
  input: { companyId: string; dealId: string; finding: Finding; analysis: DealAnalysis; title: string; due: string; today: string; by: string },
): Promise<Outcome> {
  if (!(await dealExists(db, input.companyId, input.dealId))) return { ok: false, error: NOT_FOUND };
  const f = input.finding;
  const [existing] = await db.select({ id: dealActionOutcomes.id }).from(dealActionOutcomes).where(and(eq(dealActionOutcomes.companyId, input.companyId), eq(dealActionOutcomes.dealId, input.dealId), eq(dealActionOutcomes.findingKey, f.key)));
  if (existing) return { ok: false, error: "An action was already started for this finding." };
  const [action] = await db
    .insert(managementActions)
    .values({ companyId: input.companyId, title: input.title.slice(0, 180), evidence: `${f.what} Deal ${input.analysis.deal.ref}.`.slice(0, 1000), responsible: f.owner, due: input.due, createdBy: input.by })
    .returning({ id: managementActions.id });
  const forecast = input.analysis.views.forecast;
  const [row] = await db
    .insert(dealActionOutcomes)
    .values({
      companyId: input.companyId,
      dealId: input.dealId,
      findingKey: f.key,
      actionId: action!.id,
      takenOn: input.today,
      baselineMarginPct: forecast.contributionMarginPct === null ? null : String(forecast.contributionMarginPct),
      baselineImpactJod: String(f.impactJod),
      baselineContributionJod: String(forecast.contributionAfterRebates / 1000),
      createdBy: input.by,
    })
    .returning({ id: dealActionOutcomes.id });
  return { ok: true, id: row!.id };
}

export interface OutcomeRow {
  id: string;
  findingKey: string;
  actionId: string | null;
  takenOn: string;
  baselineImpactJod: number;
  baselineMarginPct: number | null;
  verdict: "pending" | "resolved" | "improved" | "no_change" | "worsened";
  checkedOn: string | null;
  profitRecoveredJod: number | null;
  explanation: string | null;
}

export async function loadOutcomes(db: Db, companyId: string, dealId?: string): Promise<OutcomeRow[]> {
  const where = dealId ? and(eq(dealActionOutcomes.companyId, companyId), eq(dealActionOutcomes.dealId, dealId)) : eq(dealActionOutcomes.companyId, companyId);
  const rows = await db.select().from(dealActionOutcomes).where(where).orderBy(asc(dealActionOutcomes.takenOn));
  return rows.map((r) => ({ id: r.id, findingKey: r.findingKey, actionId: r.actionId, takenOn: r.takenOn, baselineImpactJod: num(r.baselineImpactJod), baselineMarginPct: r.baselineMarginPct === null ? null : Number(r.baselineMarginPct), verdict: r.verdict, checkedOn: r.checkedOn, profitRecoveredJod: r.profitRecoveredJod === null ? null : Number(r.profitRecoveredJod), explanation: r.explanation }));
}

/** Recalculates every tracked action of one deal from the CURRENT ledger and stores the verdicts. Deterministic. */
export async function checkOutcomes(db: Db, input: { companyId: string; dealId: string; today: string }): Promise<number> {
  const di = await loadDealInput(db, input.companyId, input.dealId);
  if (!di) return 0;
  const policy = await loadPolicy(db, input.companyId);
  const analysis = analyseDeal(di, policy, input.today);
  const tracked = await loadOutcomes(db, input.companyId, input.dealId);
  const baselines = await db.select().from(dealActionOutcomes).where(and(eq(dealActionOutcomes.companyId, input.companyId), eq(dealActionOutcomes.dealId, input.dealId)));
  let n = 0;
  for (const t of tracked) {
    const b = baselines.find((x) => x.id === t.id)!;
    const now = analysis.findings.find((f) => f.key === t.findingKey);
    const o = verifyOutcome(
      { findingKey: t.findingKey, takenOn: t.takenOn, marginPct: t.baselineMarginPct, impactJod: t.baselineImpactJod, contributionJod: num(b.baselineContributionJod) },
      { marginPct: analysis.views.forecast.contributionMarginPct, contributionJod: analysis.views.forecast.contributionAfterRebates / 1000, impactJod: now ? now.impactJod : null },
    );
    await db.update(dealActionOutcomes).set({ verdict: o.verdict, checkedOn: input.today, profitRecoveredJod: String(o.profitRecoveredJod), explanation: o.explanation }).where(and(eq(dealActionOutcomes.companyId, input.companyId), eq(dealActionOutcomes.id, t.id)));
    n++;
  }
  return n;
}
