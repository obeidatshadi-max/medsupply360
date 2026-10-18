"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db/client";
import { writeAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canAccess } from "@/core/permissions";
import { changeUserRole, createCompanyUser, setUserActive } from "@/server/services/company-users";

export type AddUserState = { error?: string; added?: string };

/** Only a signed-in owner may manage users; guests and every other role are refused before anything is read. */
async function owner() {
  const user = await getCurrentUser();
  return user && !user.guest && canAccess(user.role, "settings") ? user : null;
}

export async function addUserAction(_prev: AddUserState, formData: FormData): Promise<AddUserState> {
  const actor = await owner();
  if (!actor) return { error: "Only the company owner can add people." };
  const role = String(formData.get("role") ?? "");
  const result = await createCompanyUser(getDb(), {
    companyId: actor.companyId,
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    role,
    password: String(formData.get("password") ?? ""),
  });
  if (!result.ok) return { error: result.error };
  await writeAudit({ companyId: actor.companyId, userId: actor.id, action: "user.created", entityType: "user", entityId: result.userId, details: { role } });
  refresh();
  return { added: String(formData.get("fullName") ?? "").trim() };
}

export async function changeRoleAction(formData: FormData): Promise<void> {
  const actor = await owner();
  if (!actor) return;
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  const result = await changeUserRole(getDb(), { companyId: actor.companyId, actorId: actor.id, userId, role });
  if (result.ok) await writeAudit({ companyId: actor.companyId, userId: actor.id, action: "user.role_changed", entityType: "user", entityId: userId, details: { role } });
  refresh();
}

export async function setActiveAction(formData: FormData): Promise<void> {
  const actor = await owner();
  if (!actor) return;
  const userId = String(formData.get("userId") ?? "");
  const active = formData.get("active") === "true";
  const result = await setUserActive(getDb(), { companyId: actor.companyId, actorId: actor.id, userId, active });
  if (result.ok) await writeAudit({ companyId: actor.companyId, userId: actor.id, action: active ? "user.activated" : "user.deactivated", entityType: "user", entityId: userId });
  refresh();
}
