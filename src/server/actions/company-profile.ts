"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db/client";
import { canEditProfile } from "@/core/permissions";
import { readSubmitter } from "@/core/submitter";
import { writeAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";
import { saveProfile } from "@/server/services/company-profile";

export type ProfileFormState = { error?: string; saved?: boolean };

const val = (fd: FormData, key: string) => String(fd.get(key) ?? "");

export async function saveProfileAction(_prev: ProfileFormState, fd: FormData): Promise<ProfileFormState> {
  const user = await getCurrentUser();
  if (!user || user.guest || !canEditProfile(user.role)) return { error: "Only the company owner can change the company profile." };
  const who = readSubmitter(fd);
  if (!who.ok) return { error: who.error };
  const r = await saveProfile(getDb(), {
    companyId: user.companyId,
    by: who.name,
    thisYear: Number(businessToday().slice(0, 4)),
    form: { location: val(fd, "location"), address: val(fd, "address"), founded: val(fd, "founded"), team: val(fd, "team"), audience: val(fd, "audience"), purpose: val(fd, "purpose"), erp: val(fd, "erp"), notes: val(fd, "notes") },
  });
  if (!r.ok) return { error: r.error };
  await writeAudit({ companyId: user.companyId, userId: user.id, submittedBy: who.name, action: "profile.updated", entityType: "company_profile", entityId: user.companyId });
  refresh();
  return { saved: true };
}
