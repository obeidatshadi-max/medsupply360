"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db/client";
import { canManageActions } from "@/core/permissions";
import { readSubmitter } from "@/core/submitter";
import { writeAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";
import { addAction, listActions, removeAction, setActionDone } from "@/server/services/management-actions";

export type ActionFormState = { error?: string; saved?: boolean };

const REFUSED = "Only the owner and administrators can change management actions.";
const val = (fd: FormData, key: string) => String(fd.get(key) ?? "");

async function manager() {
  const user = await getCurrentUser();
  return user && !user.guest && canManageActions(user.role) ? user : null;
}

export async function addActionAction(_prev: ActionFormState, fd: FormData): Promise<ActionFormState> {
  const user = await manager();
  if (!user) return { error: REFUSED };
  const who = readSubmitter(fd);
  if (!who.ok) return { error: who.error };
  const r = await addAction(getDb(), { companyId: user.companyId, by: who.name, form: { title: val(fd, "title"), responsible: val(fd, "responsible"), due: val(fd, "due"), evidence: val(fd, "evidence") } });
  if (!r.ok) return { error: r.error };
  await writeAudit({ companyId: user.companyId, userId: user.id, submittedBy: who.name, action: "mgmt_action.added", entityType: "management_action", entityId: r.id, details: { title: val(fd, "title").trim(), responsible: val(fd, "responsible") } });
  refresh();
  return { saved: true };
}

/** One button: `done` is "true" to finish the action and "false" to reopen it. */
export async function setDoneAction(_prev: ActionFormState, fd: FormData): Promise<ActionFormState> {
  const user = await manager();
  if (!user) return { error: REFUSED };
  const who = readSubmitter(fd);
  if (!who.ok) return { error: who.error };
  const id = val(fd, "id");
  const done = val(fd, "done") === "true";
  const title = (await listActions(getDb(), user.companyId)).find((a) => a.id === id)?.title;
  const r = await setActionDone(getDb(), { companyId: user.companyId, id, done, by: who.name, today: businessToday() });
  if (!r.ok) return { error: r.error };
  await writeAudit({ companyId: user.companyId, userId: user.id, submittedBy: who.name, action: done ? "mgmt_action.completed" : "mgmt_action.reopened", entityType: "management_action", entityId: id, details: { title } });
  refresh();
  return { saved: true };
}

export async function removeActionAction(_prev: ActionFormState, fd: FormData): Promise<ActionFormState> {
  const user = await manager();
  if (!user) return { error: REFUSED };
  const who = readSubmitter(fd);
  if (!who.ok) return { error: who.error };
  const id = val(fd, "id");
  const title = (await listActions(getDb(), user.companyId)).find((a) => a.id === id)?.title;
  const r = await removeAction(getDb(), { companyId: user.companyId, id });
  if (!r.ok) return { error: r.error };
  await writeAudit({ companyId: user.companyId, userId: user.id, submittedBy: who.name, action: "mgmt_action.removed", entityType: "management_action", entityId: id, details: { title } });
  refresh();
  return { saved: true };
}
