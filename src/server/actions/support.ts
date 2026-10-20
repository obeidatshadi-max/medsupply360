"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db/client";
import { canManageSupport } from "@/core/permissions";
import { readSubmitter } from "@/core/submitter";
import { valueText, type IndicatorForm } from "@/core/support-indicators";
import { writeAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";
import { addIndicator, deleteIndicator, listIndicators, recordReading, updateIndicator } from "@/server/services/support-indicators";

export type SupportFormState = { error?: string; saved?: boolean };

const REFUSED = "Only the company owner can change support indicators.";
const val = (fd: FormData, key: string) => String(fd.get(key) ?? "");

/** Only the signed-in owner. Guests and every other role are refused. */
async function owner() {
  const user = await getCurrentUser();
  return user && !user.guest && canManageSupport(user.role) ? user : null;
}

const readForm = (fd: FormData): IndicatorForm => ({
  function: val(fd, "function"),
  name: val(fd, "name"),
  unit: val(fd, "unit"),
  direction: val(fd, "direction"),
  target: val(fd, "target"),
  responsible: val(fd, "responsible"),
  consequence: val(fd, "consequence"),
});

export async function addIndicatorAction(_prev: SupportFormState, fd: FormData): Promise<SupportFormState> {
  const user = await owner();
  if (!user) return { error: REFUSED };
  const who = readSubmitter(fd);
  if (!who.ok) return { error: who.error };
  const form = readForm(fd);
  const r = await addIndicator(getDb(), { companyId: user.companyId, form });
  if (!r.ok) return { error: r.error };
  await writeAudit({ companyId: user.companyId, userId: user.id, submittedBy: who.name, action: "support.indicator_added", entityType: "support_indicator", entityId: r.id, details: { name: form.name.trim(), department: form.function } });
  refresh();
  return { saved: true };
}

export async function updateIndicatorAction(_prev: SupportFormState, fd: FormData): Promise<SupportFormState> {
  const user = await owner();
  if (!user) return { error: REFUSED };
  const who = readSubmitter(fd);
  if (!who.ok) return { error: who.error };
  const id = val(fd, "id");
  const form = readForm(fd);
  const r = await updateIndicator(getDb(), { companyId: user.companyId, id, form });
  if (!r.ok) return { error: r.error };
  await writeAudit({ companyId: user.companyId, userId: user.id, submittedBy: who.name, action: "support.indicator_updated", entityType: "support_indicator", entityId: id, details: { name: form.name.trim() } });
  refresh();
  return { saved: true };
}

export async function recordReadingAction(_prev: SupportFormState, fd: FormData): Promise<SupportFormState> {
  const user = await owner();
  if (!user) return { error: REFUSED };
  const who = readSubmitter(fd);
  if (!who.ok) return { error: who.error };
  const id = val(fd, "id");
  const r = await recordReading(getDb(), { companyId: user.companyId, id, actual: val(fd, "actual"), measuredOn: val(fd, "measuredOn"), by: who.name, today: businessToday() });
  if (!r.ok) return { error: r.error };
  const row = (await listIndicators(getDb(), user.companyId)).find((i) => i.id === id);
  await writeAudit({
    companyId: user.companyId,
    userId: user.id,
    submittedBy: who.name,
    action: "support.reading_recorded",
    entityType: "support_indicator",
    entityId: id,
    details: { name: row?.name, reading: row ? valueText(row.actual ?? 0, row.unit) : val(fd, "actual"), measuredOn: val(fd, "measuredOn") },
  });
  refresh();
  return { saved: true };
}

export async function deleteIndicatorAction(_prev: SupportFormState, fd: FormData): Promise<SupportFormState> {
  const user = await owner();
  if (!user) return { error: REFUSED };
  const who = readSubmitter(fd);
  if (!who.ok) return { error: who.error };
  const id = val(fd, "id");
  const row = (await listIndicators(getDb(), user.companyId)).find((i) => i.id === id);
  const r = await deleteIndicator(getDb(), { companyId: user.companyId, id });
  if (!r.ok) return { error: r.error };
  await writeAudit({ companyId: user.companyId, userId: user.id, submittedBy: who.name, action: "support.indicator_deleted", entityType: "support_indicator", entityId: id, details: { name: row?.name } });
  refresh();
  return { saved: true };
}
