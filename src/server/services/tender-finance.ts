import { and, asc, eq, inArray, max } from "drizzle-orm";
import { isIsoDate } from "@/core/calc";
import type { TenderStatus } from "@/core/tender-flow";
import type { ErpInvoiceFacts } from "@/core/tender-erp";
import { GUARANTEE_KINDS, type GuaranteeKind } from "@/core/tender-money";
import type { Db } from "@/db/import-writer";
import { invoices as erpInvoices, openInvoiceSnapshots, tenderGuarantees, tenderInvoices, tenders } from "@/db/schema";
import { parseJod } from "@/core/jod";

export type GuaranteeRow = {
  id: string;
  kind: GuaranteeKind;
  amount: number;
  issuedOn: string | null;
  expiresOn: string;
  returnedOn: string | null;
  reference: string | null;
};

export type InvoiceRow = {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  amount: number;
  collected: number;
  lastCollectedOn: string | null;
};

export type FinanceResult = { ok: true; id: string } | { ok: false; error: string };

/** Invoices may be raised once a contract exists (a partial delivery can be invoiced before the whole order is delivered). */
const INVOICE_STATUSES: readonly TenderStatus[] = ["contracted", "delivered", "collected"];

const dateOrNull = (v: string): string | null | "invalid" => {
  const t = v.trim();
  if (t === "") return null;
  return isIsoDate(t) ? t : "invalid";
};

const money3 = (v: number) => v.toFixed(3);

async function tenderStatusOf(db: Db, companyId: string, tenderId: string): Promise<TenderStatus | null> {
  if (!/^[0-9a-f-]{36}$/i.test(tenderId)) return null;
  const [row] = await db.select({ status: tenders.status }).from(tenders).where(and(eq(tenders.companyId, companyId), eq(tenders.id, tenderId))).limit(1);
  return row?.status ?? null;
}

export async function listGuarantees(db: Db, companyId: string, tenderId: string): Promise<GuaranteeRow[]> {
  const rows = await db
    .select()
    .from(tenderGuarantees)
    .where(and(eq(tenderGuarantees.companyId, companyId), eq(tenderGuarantees.tenderId, tenderId)))
    .orderBy(asc(tenderGuarantees.expiresOn), asc(tenderGuarantees.createdAt));
  return rows.map((r) => ({ id: r.id, kind: r.kind, amount: Number(r.amount), issuedOn: r.issuedOn, expiresOn: r.expiresOn, returnedOn: r.returnedOn, reference: r.reference }));
}

export type GuaranteeForm = { kind: string; amount: string; issuedOn: string; expiresOn: string; returnedOn: string; reference: string };

function cleanGuarantee(f: GuaranteeForm): { ok: true; v: { kind: GuaranteeKind; amount: number; issuedOn: string | null; expiresOn: string; returnedOn: string | null; reference: string | null } } | { ok: false; error: string } {
  if (!(GUARANTEE_KINDS as readonly string[]).includes(f.kind)) return { ok: false, error: "Choose bid guarantee or performance guarantee." };
  const amount = parseJod(f.amount);
  if (amount === "invalid" || amount === null || amount <= 0) return { ok: false, error: "Enter the guarantee amount in JOD, above zero." };
  const issuedOn = dateOrNull(f.issuedOn);
  const returnedOn = dateOrNull(f.returnedOn);
  const expiresOn = dateOrNull(f.expiresOn);
  if (issuedOn === "invalid") return { ok: false, error: "The issue date is not a valid date." };
  if (returnedOn === "invalid") return { ok: false, error: "The return date is not a valid date." };
  if (expiresOn === "invalid" || expiresOn === null) return { ok: false, error: "Enter the date the guarantee expires." };
  if (issuedOn && issuedOn > expiresOn) return { ok: false, error: "The guarantee cannot expire before it was issued." };
  if (issuedOn && returnedOn && returnedOn < issuedOn) return { ok: false, error: "The guarantee cannot be returned before it was issued." };
  const reference = f.reference.trim().slice(0, 80);
  return { ok: true, v: { kind: f.kind as GuaranteeKind, amount, issuedOn, expiresOn, returnedOn, reference: reference || null } };
}

export async function addGuarantee(db: Db, input: { companyId: string; userId: string; tenderId: string; form: GuaranteeForm }): Promise<FinanceResult> {
  if (!(await tenderStatusOf(db, input.companyId, input.tenderId))) return { ok: false, error: "That tender was not found." };
  const c = cleanGuarantee(input.form);
  if (!c.ok) return c;
  const [row] = await db
    .insert(tenderGuarantees)
    .values({ companyId: input.companyId, tenderId: input.tenderId, kind: c.v.kind, amount: money3(c.v.amount), issuedOn: c.v.issuedOn, expiresOn: c.v.expiresOn, returnedOn: c.v.returnedOn, reference: c.v.reference, createdBy: input.userId })
    .returning({ id: tenderGuarantees.id });
  return { ok: true, id: row!.id };
}

export async function updateGuarantee(db: Db, input: { companyId: string; tenderId: string; guaranteeId: string; form: GuaranteeForm }): Promise<FinanceResult> {
  const c = cleanGuarantee(input.form);
  if (!c.ok) return c;
  const changed = await db
    .update(tenderGuarantees)
    .set({ kind: c.v.kind, amount: money3(c.v.amount), issuedOn: c.v.issuedOn, expiresOn: c.v.expiresOn, returnedOn: c.v.returnedOn, reference: c.v.reference })
    .where(and(eq(tenderGuarantees.companyId, input.companyId), eq(tenderGuarantees.tenderId, input.tenderId), eq(tenderGuarantees.id, input.guaranteeId)))
    .returning({ id: tenderGuarantees.id });
  return changed.length ? { ok: true, id: input.guaranteeId } : { ok: false, error: "That guarantee was not found." };
}

export async function deleteGuarantee(db: Db, input: { companyId: string; tenderId: string; guaranteeId: string }): Promise<FinanceResult> {
  const gone = await db
    .delete(tenderGuarantees)
    .where(and(eq(tenderGuarantees.companyId, input.companyId), eq(tenderGuarantees.tenderId, input.tenderId), eq(tenderGuarantees.id, input.guaranteeId)))
    .returning({ id: tenderGuarantees.id });
  return gone.length ? { ok: true, id: input.guaranteeId } : { ok: false, error: "That guarantee was not found." };
}

export async function listInvoices(db: Db, companyId: string, tenderId: string): Promise<InvoiceRow[]> {
  const rows = await db
    .select()
    .from(tenderInvoices)
    .where(and(eq(tenderInvoices.companyId, companyId), eq(tenderInvoices.tenderId, tenderId)))
    .orderBy(asc(tenderInvoices.invoiceDate), asc(tenderInvoices.invoiceNo));
  return rows.map((r) => ({ id: r.id, invoiceNo: r.invoiceNo, invoiceDate: r.invoiceDate, amount: Number(r.amount), collected: Number(r.collectedAmount), lastCollectedOn: r.lastCollectedOn }));
}

/**
 * What the ERP files say about these invoice numbers: whether each exists and how much of it the newest unpaid-invoice
 * file still lists. Keyed by invoice number; numbers the ERP does not know are absent from the map.
 */
export async function erpFactsByInvoiceNo(db: Db, companyId: string, invoiceNos: string[]): Promise<Map<string, ErpInvoiceFacts>> {
  const out = new Map<string, ErpInvoiceFacts>();
  if (invoiceNos.length === 0) return out;
  const [latest] = await db.select({ d: max(openInvoiceSnapshots.snapshotDate) }).from(openInvoiceSnapshots).where(eq(openInvoiceSnapshots.companyId, companyId));
  const snapshotDate = latest?.d ?? null;
  const known = await db.select({ id: erpInvoices.id, no: erpInvoices.invoiceNo }).from(erpInvoices).where(and(eq(erpInvoices.companyId, companyId), inArray(erpInvoices.invoiceNo, invoiceNos)));
  const remaining = new Map<string, number>();
  if (snapshotDate && known.length) {
    const rows = await db
      .select({ invoiceId: openInvoiceSnapshots.invoiceId, remaining: openInvoiceSnapshots.remainingAmount })
      .from(openInvoiceSnapshots)
      .where(and(eq(openInvoiceSnapshots.companyId, companyId), eq(openInvoiceSnapshots.snapshotDate, snapshotDate), inArray(openInvoiceSnapshots.invoiceId, known.map((k) => k.id))));
    for (const r of rows) remaining.set(r.invoiceId, Number(r.remaining));
  }
  for (const k of known) out.set(k.no, { found: true, snapshotDate, remaining: remaining.get(k.id) ?? null });
  return out;
}

export type InvoiceForm = { invoiceNo: string; invoiceDate: string; amount: string };

export async function addInvoice(db: Db, input: { companyId: string; userId: string; tenderId: string; form: InvoiceForm }): Promise<FinanceResult> {
  const status = await tenderStatusOf(db, input.companyId, input.tenderId);
  if (!status) return { ok: false, error: "That tender was not found." };
  if (!INVOICE_STATUSES.includes(status)) return { ok: false, error: "Invoices can be recorded once the tender is contracted." };
  const invoiceNo = input.form.invoiceNo.trim().slice(0, 80);
  if (!invoiceNo) return { ok: false, error: "Enter the invoice number." };
  const date = dateOrNull(input.form.invoiceDate);
  if (date === "invalid" || date === null) return { ok: false, error: "Enter a valid invoice date." };
  const amount = parseJod(input.form.amount);
  if (amount === "invalid" || amount === null || amount <= 0) return { ok: false, error: "Enter the invoice amount in JOD, above zero." };
  try {
    const [row] = await db
      .insert(tenderInvoices)
      .values({ companyId: input.companyId, tenderId: input.tenderId, invoiceNo, invoiceDate: date, amount: money3(amount), createdBy: input.userId })
      .returning({ id: tenderInvoices.id });
    return { ok: true, id: row!.id };
  } catch (err) {
    const e = err as { code?: string; cause?: { code?: string } };
    if (e?.code === "23505" || e?.cause?.code === "23505") return { ok: false, error: "This invoice number is already recorded for this tender." };
    throw err;
  }
}

/** Set how much of an invoice has been paid so far (a running total, not an extra payment) and the date of the latest payment. */
export async function setCollected(db: Db, input: { companyId: string; tenderId: string; invoiceId: string; collected: string; collectedOn: string }): Promise<FinanceResult> {
  const amount = parseJod(input.collected);
  if (amount === "invalid" || amount === null) return { ok: false, error: "Enter the total collected so far in JOD, for example 0 or 1,500." };
  const on = dateOrNull(input.collectedOn);
  if (on === "invalid") return { ok: false, error: "The payment date is not a valid date." };
  if (amount > 0 && on === null) return { ok: false, error: "Enter the date of the latest payment." };
  const [invoice] = await db
    .select({ amount: tenderInvoices.amount })
    .from(tenderInvoices)
    .where(and(eq(tenderInvoices.companyId, input.companyId), eq(tenderInvoices.tenderId, input.tenderId), eq(tenderInvoices.id, input.invoiceId)))
    .limit(1);
  if (!invoice) return { ok: false, error: "That invoice was not found." };
  if (amount > Number(invoice.amount)) return { ok: false, error: `More than the invoice amount (JOD ${Number(invoice.amount).toFixed(3)}) cannot be collected.` };
  await db
    .update(tenderInvoices)
    .set({ collectedAmount: money3(amount), lastCollectedOn: amount > 0 ? on : null })
    .where(and(eq(tenderInvoices.companyId, input.companyId), eq(tenderInvoices.tenderId, input.tenderId), eq(tenderInvoices.id, input.invoiceId)));
  return { ok: true, id: input.invoiceId };
}

export async function deleteInvoice(db: Db, input: { companyId: string; tenderId: string; invoiceId: string }): Promise<FinanceResult> {
  const status = await tenderStatusOf(db, input.companyId, input.tenderId);
  if (status === "collected") return { ok: false, error: "Step the tender back from Collected before removing an invoice." };
  const gone = await db
    .delete(tenderInvoices)
    .where(and(eq(tenderInvoices.companyId, input.companyId), eq(tenderInvoices.tenderId, input.tenderId), eq(tenderInvoices.id, input.invoiceId)))
    .returning({ id: tenderInvoices.id });
  return gone.length ? { ok: true, id: input.invoiceId } : { ok: false, error: "That invoice was not found." };
}
