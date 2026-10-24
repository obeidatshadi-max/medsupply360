"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { getDb } from "@/db/client";
import { writeAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canAccess, canEditTender, canMoveTender } from "@/core/permissions";
import { STATUSES, type TenderStatus } from "@/core/tender-flow";
import { readSubmitter } from "@/core/submitter";
import { createTender, moveTender, updateTender, type TenderForm } from "@/server/services/tenders";

export type TenderFormState = { error?: string; saved?: boolean };

const val = (fd: FormData, key: string) => String(fd.get(key) ?? "");

/** The editable fields of a tender, as typed. Every form posts all of them (hidden ones carry the current value), so a save never blanks a field it did not show. */
function readForm(fd: FormData): TenderForm {
  return {
    authority: val(fd, "authority"),
    tenderNo: val(fd, "tenderNo"),
    title: val(fd, "title"),
    productLine: val(fd, "productLine"),
    estimatedValue: val(fd, "estimatedValue"),
    deadline: val(fd, "deadline"),
    bidValue: val(fd, "bidValue"),
    awardAmount: val(fd, "awardAmount"),
    closeReason: val(fd, "closeReason"),
    closeReasonCode: val(fd, "closeReasonCode"),
    winnerName: val(fd, "winnerName"),
    winningPrice: val(fd, "winningPrice"),
    expectedAwardDate: val(fd, "expectedAwardDate"),
    contractNo: val(fd, "contractNo"),
    contractValue: val(fd, "contractValue"),
    deliveredOn: val(fd, "deliveredOn"),
    notes: val(fd, "notes"),
  };
}

/** A signed-in user whose role may open the tender section. Guests never qualify. */
async function tenderUser() {
  const user = await getCurrentUser();
  return user && !user.guest && canAccess(user.role, "tender") ? user : null;
}

export async function createTenderAction(_prev: TenderFormState, formData: FormData): Promise<TenderFormState> {
  const user = await tenderUser();
  if (!user || !canEditTender(user.role)) return { error: "Only the tender department can record tenders." };
  const who = readSubmitter(formData);
  if (!who.ok) return { error: who.error };
  const startAs = val(formData, "startAs") === "open" ? "open" : "pipeline";
  const result = await createTender(getDb(), { companyId: user.companyId, userId: user.id, submittedBy: who.name, form: readForm(formData), startAs });
  if (!result.ok) return { error: result.error };
  await writeAudit({ companyId: user.companyId, userId: user.id, submittedBy: who.name, action: "tender.created", entityType: "tender", entityId: result.id });
  redirect(`/tenders/${result.id}`);
}

export async function updateTenderAction(_prev: TenderFormState, formData: FormData): Promise<TenderFormState> {
  const user = await tenderUser();
  if (!user || !canEditTender(user.role)) return { error: "Only the tender department can change tender details." };
  const who = readSubmitter(formData);
  if (!who.ok) return { error: who.error };
  const tenderId = val(formData, "tenderId");
  const result = await updateTender(getDb(), { companyId: user.companyId, tenderId, form: readForm(formData) });
  if (!result.ok) return { error: result.error };
  await writeAudit({ companyId: user.companyId, userId: user.id, submittedBy: who.name, action: "tender.updated", entityType: "tender", entityId: tenderId });
  refresh();
  return { saved: true };
}

export async function moveTenderAction(_prev: TenderFormState, formData: FormData): Promise<TenderFormState> {
  const user = await tenderUser();
  if (!user) return { error: "You cannot change tenders." };
  const who = readSubmitter(formData);
  if (!who.ok) return { error: who.error };
  const to = val(formData, "to");
  const seen = val(formData, "seenStatus");
  const known = (s: string): s is TenderStatus => (STATUSES as readonly string[]).includes(s);
  if (!known(to) || !known(seen)) return { error: "That move is not valid." };
  if (!canMoveTender(user.role, seen, to)) return { error: "Your role cannot make this change." };
  const tenderId = val(formData, "tenderId");
  const result = await moveTender(getDb(), {
    companyId: user.companyId,
    userId: user.id,
    submittedBy: who.name,
    role: user.role,
    tenderId,
    to,
    seenStatus: seen,
    form: readForm(formData),
    note: val(formData, "note"),
  });
  if (!result.ok) return { error: result.error };
  await writeAudit({ companyId: user.companyId, userId: user.id, submittedBy: who.name, action: "tender.moved", entityType: "tender", entityId: tenderId, details: { from: seen, to } });
  refresh();
  return { saved: true };
}
