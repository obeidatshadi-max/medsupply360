"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db/client";
import { analyseDeal } from "@/core/deal-margin";
import { matchCosts, parseCostFile } from "@/core/deal-margin/import";
import { canEditDealMargin } from "@/core/permissions";
import { readSubmitter } from "@/core/submitter";
import { isIsoDate } from "@/core/calc";
import { writeAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";
import { addEntry, addRebate, checkOutcomes, createDeal, importEntries, loadDealIdentifiers, loadDealInput, loadPolicy, reviewEntry, savePolicy, startAction } from "@/server/services/deal-margin";

export type DealFormState = { error?: string; saved?: boolean; id?: string; message?: string };

const REFUSED = "Only the owner can change deal costs and thresholds.";
const val = (fd: FormData, key: string) => String(fd.get(key) ?? "");

async function owner() {
  const user = await getCurrentUser();
  return user && !user.guest && canEditDealMargin(user.role) ? user : null;
}

const FIELD_KEYS = {
  deal: ["kind", "ref", "title", "customerName", "customerRef", "contractPrice", "quoteDiscount", "quoteAcquisition", "quoteFreightCustoms", "quoteInstallation", "quoteWarranty", "quoteCommission", "quoteFinancing", "quoteOther", "quoteRebate", "warrantyMonths", "hasInstallation", "deliveredPct", "installedPct", "receivableOutstanding", "collectionDaysLate", "warrantyOpen", "serviceOpen", "contractNo", "tenderNo", "projectRefs", "invoiceNos", "serials", "poNos", "windowStart", "windowEnd"],
  entry: ["line", "amount", "currency", "fxRate", "vatIncluded", "vatRate", "status", "provision", "docType", "docNo", "sourceKey", "coveredBy", "incurredOn", "note"],
  rebate: ["supplier", "amount", "currency", "fxRate", "status", "evidenceRef", "creditNoteRef"],
  policy: ["minContributionMarginPct", "maxDiscountPct", "costOverrunTolerancePct", "deteriorationPp", "financingRateAnnualPct", "roundingToleranceFils"],
} as const;
const pick = <K extends readonly string[]>(fd: FormData, keys: K) => Object.fromEntries(keys.map((k) => [k, val(fd, k)])) as Record<K[number], string>;

export async function addDealAction(_prev: DealFormState, fd: FormData): Promise<DealFormState> {
  const user = await owner();
  if (!user) return { error: REFUSED };
  const who = readSubmitter(fd);
  if (!who.ok) return { error: who.error };
  const r = await createDeal(getDb(), { companyId: user.companyId, by: who.name, form: pick(fd, FIELD_KEYS.deal) });
  if (!r.ok) return { error: r.error };
  await writeAudit({ companyId: user.companyId, userId: user.id, submittedBy: who.name, action: "deal.created", entityType: "deal", entityId: r.id, details: { ref: val(fd, "ref").trim() } });
  refresh();
  return { saved: true, id: r.id };
}

export async function addEntryAction(_prev: DealFormState, fd: FormData): Promise<DealFormState> {
  const user = await owner();
  if (!user) return { error: REFUSED };
  const who = readSubmitter(fd);
  if (!who.ok) return { error: who.error };
  const dealId = val(fd, "dealId");
  const r = await addEntry(getDb(), { companyId: user.companyId, dealId, by: who.name, form: pick(fd, FIELD_KEYS.entry) });
  if (!r.ok) return { error: r.error };
  await writeAudit({ companyId: user.companyId, userId: user.id, submittedBy: who.name, action: "deal.entry_added", entityType: "deal", entityId: dealId, details: { line: val(fd, "line"), amount: val(fd, "amount"), status: val(fd, "status") } });
  refresh();
  return { saved: true };
}

export async function addRebateAction(_prev: DealFormState, fd: FormData): Promise<DealFormState> {
  const user = await owner();
  if (!user) return { error: REFUSED };
  const who = readSubmitter(fd);
  if (!who.ok) return { error: who.error };
  const dealId = val(fd, "dealId");
  const r = await addRebate(getDb(), { companyId: user.companyId, dealId, by: who.name, form: pick(fd, FIELD_KEYS.rebate) });
  if (!r.ok) return { error: r.error };
  await writeAudit({ companyId: user.companyId, userId: user.id, submittedBy: who.name, action: "deal.rebate_added", entityType: "deal", entityId: dealId, details: { supplier: val(fd, "supplier"), status: val(fd, "status"), amount: val(fd, "amount") } });
  refresh();
  return { saved: true };
}

/** One button per decision: `decision` is "confirmed" or "rejected"; `moveTo` (optional) is another deal of this company. */
export async function reviewEntryAction(_prev: DealFormState, fd: FormData): Promise<DealFormState> {
  const user = await owner();
  if (!user) return { error: REFUSED };
  const who = readSubmitter(fd);
  if (!who.ok) return { error: who.error };
  const decision = val(fd, "decision") === "rejected" ? "rejected" : "confirmed";
  const moveTo = val(fd, "moveTo");
  const r = await reviewEntry(getDb(), { companyId: user.companyId, entryId: val(fd, "entryId"), decision, moveToDealId: moveTo === "" ? null : moveTo, by: who.name });
  if (!r.ok) return { error: r.error };
  await writeAudit({ companyId: user.companyId, userId: user.id, submittedBy: who.name, action: `deal.entry_${decision}`, entityType: "deal_entry", entityId: r.id, details: { moveTo: moveTo || null } });
  refresh();
  return { saved: true };
}

export async function savePolicyAction(_prev: DealFormState, fd: FormData): Promise<DealFormState> {
  const user = await owner();
  if (!user) return { error: REFUSED };
  const who = readSubmitter(fd);
  if (!who.ok) return { error: who.error };
  const r = await savePolicy(getDb(), { companyId: user.companyId, by: who.name, form: pick(fd, FIELD_KEYS.policy) });
  if (!r.ok) return { error: r.error };
  await writeAudit({ companyId: user.companyId, userId: user.id, submittedBy: who.name, action: "margin_policy.saved", entityType: "margin_policy", entityId: user.companyId, details: pick(fd, FIELD_KEYS.policy) });
  refresh();
  return { saved: true };
}

/** Starts a management action from a finding the engine raised NOW. The finding key is looked up again, never trusted from the form. */
export async function startActionAction(_prev: DealFormState, fd: FormData): Promise<DealFormState> {
  const user = await owner();
  if (!user) return { error: REFUSED };
  const who = readSubmitter(fd);
  if (!who.ok) return { error: who.error };
  const dealId = val(fd, "dealId");
  const due = val(fd, "due");
  if (!isIsoDate(due)) return { error: "Choose the due date." };
  const db = getDb();
  const input = await loadDealInput(db, user.companyId, dealId);
  if (!input) return { error: "That deal was not found." };
  const today = businessToday();
  const analysis = analyseDeal(input, await loadPolicy(db, user.companyId), today);
  const finding = analysis.findings.find((f) => f.key === val(fd, "findingKey"));
  if (!finding) return { error: "The rules no longer raise that finding, so there is nothing to act on." };
  const r = await startAction(db, { companyId: user.companyId, dealId, finding, analysis, title: val(fd, "title") || finding.title, due, today, by: who.name });
  if (!r.ok) return { error: r.error };
  await writeAudit({ companyId: user.companyId, userId: user.id, submittedBy: who.name, action: "deal.action_started", entityType: "deal", entityId: dealId, details: { finding: finding.key, owner: finding.owner } });
  refresh();
  return { saved: true };
}

export async function checkOutcomesAction(_prev: DealFormState, fd: FormData): Promise<DealFormState> {
  const user = await owner();
  if (!user) return { error: REFUSED };
  const n = await checkOutcomes(getDb(), { companyId: user.companyId, dealId: val(fd, "dealId"), today: businessToday() });
  refresh();
  return { saved: true, message: n === 0 ? "No tracked action to check yet." : `Checked ${n} action${n === 1 ? "" : "s"} against the current numbers.` };
}

const MAX_CSV_CHARS = 4_000_000;

/** Reads the cost file the browser converted to CSV, matches each row to a deal of this company, and writes idempotently. */
export async function importCostsAction(_prev: DealFormState, fd: FormData): Promise<DealFormState> {
  const user = await owner();
  if (!user) return { error: REFUSED };
  const who = readSubmitter(fd);
  if (!who.ok) return { error: who.error };
  const csv = val(fd, "csv");
  if (csv.trim() === "") return { error: "Choose a file first." };
  if (csv.length > MAX_CSV_CHARS) return { error: "The file is too large. Send it in parts of at most 20,000 rows." };
  const db = getDb();
  const parsed = parseCostFile(csv, "ERP");
  if (parsed.transactions.length === 0 && parsed.errors.length > 0) return { error: `Nothing was imported. Row ${parsed.errors[0]!.row}: ${parsed.errors[0]!.reason}` };
  const matched = matchCosts(parsed, await loadDealIdentifiers(db, user.companyId));
  const summary = await importEntries(db, { companyId: user.companyId, entries: matched.entries, by: who.name });
  await writeAudit({ companyId: user.companyId, userId: user.id, submittedBy: who.name, action: "deal.costs_imported", entityType: "deal", entityId: user.companyId, details: { rows: parsed.rows, rejected: parsed.errors.length, unmatched: matched.unmatched.length, ...summary } });
  refresh();
  return {
    saved: true,
    message: `${summary.inserted} new, ${summary.updated} corrected, ${summary.unchanged} already there. ${matched.exact} matched exactly; ${matched.needReview} wait for your review. ${matched.unmatched.length} could not be tied to any deal and were not saved. ${parsed.errors.length} row${parsed.errors.length === 1 ? "" : "s"} could not be read${parsed.errors[0] ? ` (first: row ${parsed.errors[0].row}, ${parsed.errors[0].reason})` : ""}.`,
  };
}
