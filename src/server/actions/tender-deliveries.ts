"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db/client";
import { writeAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canAccess, canEditTender } from "@/core/permissions";
import { readSubmitter } from "@/core/submitter";
import { addDelivery, deleteDelivery, type DeliveryResult } from "@/server/services/tender-deliveries";

export type DeliveryFormState = { error?: string; saved?: boolean };

const val = (fd: FormData, key: string) => String(fd.get(key) ?? "");

async function deliveryUser() {
  const user = await getCurrentUser();
  return user && !user.guest && canAccess(user.role, "tender") && canEditTender(user.role) ? user : null;
}

async function finish(result: DeliveryResult, audit: { companyId: string; userId: string; submittedBy: string; action: string; tenderId: string }): Promise<DeliveryFormState> {
  if (!result.ok) return { error: result.error };
  await writeAudit({ companyId: audit.companyId, userId: audit.userId, submittedBy: audit.submittedBy, action: audit.action, entityType: "tender_delivery", entityId: result.id, details: { tenderId: audit.tenderId } });
  refresh();
  return { saved: true };
}

export async function addDeliveryAction(_prev: DeliveryFormState, fd: FormData): Promise<DeliveryFormState> {
  const user = await deliveryUser();
  if (!user) return { error: "Only the tender department can record deliveries." };
  const who = readSubmitter(fd);
  if (!who.ok) return { error: who.error };
  const tenderId = val(fd, "tenderId");
  const r = await addDelivery(getDb(), { companyId: user.companyId, userId: user.id, tenderId, form: { deliveredOn: val(fd, "deliveredOn"), value: val(fd, "value"), note: val(fd, "note") } });
  return finish(r, { companyId: user.companyId, userId: user.id, submittedBy: who.name, action: "tender.delivery_added", tenderId });
}

export async function deleteDeliveryAction(fd: FormData): Promise<void> {
  const user = await deliveryUser();
  if (!user) return;
  const who = readSubmitter(fd);
  if (!who.ok) return;
  const tenderId = val(fd, "tenderId");
  const r = await deleteDelivery(getDb(), { companyId: user.companyId, tenderId, deliveryId: val(fd, "deliveryId") });
  await finish(r, { companyId: user.companyId, userId: user.id, submittedBy: who.name, action: "tender.delivery_deleted", tenderId });
}
