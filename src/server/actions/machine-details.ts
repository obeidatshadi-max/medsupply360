"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db/client";
import { cleanMachineDetails } from "@/core/machine-details";
import { readSubmitter } from "@/core/submitter";
import { writeAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";
import { companyInstalledUnits } from "@/lib/installed-base";
import { saveMachineDetails } from "@/server/services/machine-details";

export type MachineFormState = { error?: string; saved?: boolean };

const val = (fd: FormData, key: string) => String(fd.get(key) ?? "");

/** Owner only, like every other file or form in Data. The machine must be one the app already knows. */
export async function saveMachineDetailsAction(_prev: MachineFormState, fd: FormData): Promise<MachineFormState> {
  const user = await getCurrentUser();
  if (!user || user.guest || user.role !== "owner") return { error: "Only the company owner can add machine details." };
  const who = readSubmitter(fd);
  if (!who.ok) return { error: who.error };
  const c = cleanMachineDetails({ code: val(fd, "code"), installedOn: val(fd, "installedOn"), warrantyEnd: val(fd, "warrantyEnd"), service: val(fd, "service"), expectedMonthly: val(fd, "expectedMonthly") }, businessToday());
  if (!c.ok) return { error: c.error };
  const unit = (await companyInstalledUnits(user.companyId)).find((u) => u.code === c.value.code);
  if (!unit) return { error: "Choose the machine from the list." };
  const r = await saveMachineDetails(getDb(), { companyId: user.companyId, unit, details: c.value });
  if (!r.ok) return { error: r.error };
  await writeAudit({ companyId: user.companyId, userId: user.id, submittedBy: who.name, action: "machine.details_saved", entityType: "installed_unit", entityId: unit.code, details: { name: `${unit.name} at ${unit.customerName}` } });
  refresh();
  return { saved: true };
}
