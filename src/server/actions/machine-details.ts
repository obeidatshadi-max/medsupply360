"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db/client";
import { cleanMachineDetails, cleanNewMachine } from "@/core/machine-details";
import { readSubmitter } from "@/core/submitter";
import { writeAudit } from "@/lib/audit";
import { canUploadEquipment } from "@/core/permissions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";
import { companyInstalledUnits } from "@/lib/installed-base";
import { addMachine, saveMachineDetails } from "@/server/services/machine-details";

export type MachineFormState = { error?: string; saved?: boolean };

const val = (fd: FormData, key: string) => String(fd.get(key) ?? "");

/** The owner and the maintenance department. The machine must be one the app already knows. */
export async function saveMachineDetailsAction(_prev: MachineFormState, fd: FormData): Promise<MachineFormState> {
  const user = await getCurrentUser();
  if (!user || user.guest || !canUploadEquipment(user.role)) return { error: "Only the owner and the maintenance department can add machine details." };
  const who = readSubmitter(fd);
  if (!who.ok) return { error: who.error };
  const c = cleanMachineDetails({ code: val(fd, "code"), installedOn: val(fd, "installedOn"), warrantyEnd: val(fd, "warrantyEnd"), service: val(fd, "service"), expectedMonthly: val(fd, "expectedMonthly"), contractStart: val(fd, "contractStart"), contractEnd: val(fd, "contractEnd"), contactName: val(fd, "contactName"), contactPhone: val(fd, "contactPhone"), contactEmail: val(fd, "contactEmail") }, businessToday());
  if (!c.ok) return { error: c.error };
  const unit = (await companyInstalledUnits(user.companyId)).find((u) => u.code === c.value.code);
  if (!unit) return { error: "Choose the machine from the list." };
  const r = await saveMachineDetails(getDb(), { companyId: user.companyId, unit, details: c.value });
  if (!r.ok) return { error: r.error };
  await writeAudit({ companyId: user.companyId, userId: user.id, submittedBy: who.name, action: "machine.details_saved", entityType: "installed_unit", entityId: unit.code, details: { name: `${unit.name} at ${unit.customerName}` } });
  refresh();
  return { saved: true };
}

/** Adds a machine that is not in the sales. The owner and the maintenance department; the customer and code are checked against what is recorded. */
export async function addMachineAction(_prev: MachineFormState, fd: FormData): Promise<MachineFormState> {
  const user = await getCurrentUser();
  if (!user || user.guest || !canUploadEquipment(user.role)) return { error: "Only the owner and the maintenance department can add a machine." };
  const who = readSubmitter(fd);
  if (!who.ok) return { error: who.error };
  const c = cleanNewMachine(
    {
      code: val(fd, "code"),
      name: val(fd, "name"),
      customerCode: val(fd, "customerCode"),
      installedOn: val(fd, "installedOn"),
      warrantyEnd: val(fd, "warrantyEnd"),
      service: val(fd, "service"),
      expectedMonthly: val(fd, "expectedMonthly"),
      contractStart: val(fd, "contractStart"),
      contractEnd: val(fd, "contractEnd"),
      contactName: val(fd, "contactName"),
      contactPhone: val(fd, "contactPhone"),
      contactEmail: val(fd, "contactEmail"),
    },
    businessToday(),
  );
  if (!c.ok) return { error: c.error };
  const r = await addMachine(getDb(), { companyId: user.companyId, machine: c.value });
  if (!r.ok) return { error: r.error };
  await writeAudit({ companyId: user.companyId, userId: user.id, submittedBy: who.name, action: "machine.details_saved", entityType: "installed_unit", entityId: c.value.code, details: { name: c.value.name, added: true } });
  refresh();
  return { saved: true };
}
