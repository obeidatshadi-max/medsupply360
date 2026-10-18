"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db/client";
import { writeAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canAccess, canEditGuarantees, canEditPayments } from "@/core/permissions";
import { addGuarantee, addInvoice, deleteGuarantee, deleteInvoice, setCollected, updateGuarantee, type FinanceResult, type GuaranteeForm } from "@/server/services/tender-finance";

export type FinanceFormState = { error?: string; saved?: boolean };

const val = (fd: FormData, key: string) => String(fd.get(key) ?? "");

async function tenderUser() {
  const user = await getCurrentUser();
  return user && !user.guest && canAccess(user.role, "tender") ? user : null;
}

const guaranteeForm = (fd: FormData): GuaranteeForm => ({
  kind: val(fd, "kind"),
  amount: val(fd, "amount"),
  issuedOn: val(fd, "issuedOn"),
  expiresOn: val(fd, "expiresOn"),
  returnedOn: val(fd, "returnedOn"),
  reference: val(fd, "reference"),
});

async function finish(result: FinanceResult, audit: { companyId: string; userId: string; action: string; entityType: string; tenderId: string; details?: Record<string, unknown> }): Promise<FinanceFormState> {
  if (!result.ok) return { error: result.error };
  await writeAudit({ companyId: audit.companyId, userId: audit.userId, action: audit.action, entityType: audit.entityType, entityId: result.id, details: { tenderId: audit.tenderId, ...audit.details } });
  refresh();
  return { saved: true };
}

export async function addGuaranteeAction(_prev: FinanceFormState, fd: FormData): Promise<FinanceFormState> {
  const user = await tenderUser();
  if (!user || !canEditGuarantees(user.role)) return { error: "Your role cannot record guarantees." };
  const tenderId = val(fd, "tenderId");
  const r = await addGuarantee(getDb(), { companyId: user.companyId, userId: user.id, tenderId, form: guaranteeForm(fd) });
  return finish(r, { companyId: user.companyId, userId: user.id, action: "tender.guarantee_added", entityType: "tender_guarantee", tenderId, details: { kind: val(fd, "kind") } });
}

export async function updateGuaranteeAction(_prev: FinanceFormState, fd: FormData): Promise<FinanceFormState> {
  const user = await tenderUser();
  if (!user || !canEditGuarantees(user.role)) return { error: "Your role cannot change guarantees." };
  const tenderId = val(fd, "tenderId");
  const r = await updateGuarantee(getDb(), { companyId: user.companyId, tenderId, guaranteeId: val(fd, "guaranteeId"), form: guaranteeForm(fd) });
  return finish(r, { companyId: user.companyId, userId: user.id, action: "tender.guarantee_updated", entityType: "tender_guarantee", tenderId });
}

export async function deleteGuaranteeAction(fd: FormData): Promise<void> {
  const user = await tenderUser();
  if (!user || !canEditGuarantees(user.role)) return;
  const tenderId = val(fd, "tenderId");
  const r = await deleteGuarantee(getDb(), { companyId: user.companyId, tenderId, guaranteeId: val(fd, "guaranteeId") });
  await finish(r, { companyId: user.companyId, userId: user.id, action: "tender.guarantee_deleted", entityType: "tender_guarantee", tenderId });
}

export async function addInvoiceAction(_prev: FinanceFormState, fd: FormData): Promise<FinanceFormState> {
  const user = await tenderUser();
  if (!user || !canEditPayments(user.role)) return { error: "Only finance can record invoices." };
  const tenderId = val(fd, "tenderId");
  const r = await addInvoice(getDb(), { companyId: user.companyId, userId: user.id, tenderId, form: { invoiceNo: val(fd, "invoiceNo"), invoiceDate: val(fd, "invoiceDate"), amount: val(fd, "amount") } });
  return finish(r, { companyId: user.companyId, userId: user.id, action: "tender.invoice_added", entityType: "tender_invoice", tenderId });
}

export async function setCollectedAction(_prev: FinanceFormState, fd: FormData): Promise<FinanceFormState> {
  const user = await tenderUser();
  if (!user || !canEditPayments(user.role)) return { error: "Only finance can record payments." };
  const tenderId = val(fd, "tenderId");
  const r = await setCollected(getDb(), { companyId: user.companyId, tenderId, invoiceId: val(fd, "invoiceId"), collected: val(fd, "collected"), collectedOn: val(fd, "collectedOn") });
  return finish(r, { companyId: user.companyId, userId: user.id, action: "tender.payment_recorded", entityType: "tender_invoice", tenderId, details: { collected: val(fd, "collected") } });
}

export async function deleteInvoiceAction(fd: FormData): Promise<void> {
  const user = await tenderUser();
  if (!user || !canEditPayments(user.role)) return;
  const tenderId = val(fd, "tenderId");
  const r = await deleteInvoice(getDb(), { companyId: user.companyId, tenderId, invoiceId: val(fd, "invoiceId") });
  await finish(r, { companyId: user.companyId, userId: user.id, action: "tender.invoice_deleted", entityType: "tender_invoice", tenderId });
}
