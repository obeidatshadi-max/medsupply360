"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db/client";
import { writeAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canAccess, canEditTender } from "@/core/permissions";
import { readSubmitter } from "@/core/submitter";
import type { ItemForm } from "@/core/tender-items";
import { saveTenderItems } from "@/server/services/tender-items";

export type ItemsFormState = { error?: string; saved?: boolean; message?: string };

const FIELDS = ["itemName", "quantity", "unit", "estimatedUnitPrice", "ourUnitPrice"] as const;

/** The posted rows: each field arrives once per row, in the same order (`itemName` x N, `quantity` x N ...). */
function readRows(fd: FormData): ItemForm[] {
  const cols = FIELDS.map((f) => fd.getAll(f).map(String));
  const n = Math.max(...cols.map((c) => c.length));
  return Array.from({ length: n }, (_, i) => Object.fromEntries(FIELDS.map((f, k) => [f, cols[k]![i] ?? ""])) as unknown as ItemForm);
}

export async function saveTenderItemsAction(_prev: ItemsFormState, formData: FormData): Promise<ItemsFormState> {
  const user = await getCurrentUser();
  if (!user || user.guest || !canAccess(user.role, "tender") || !canEditTender(user.role)) return { error: "Only the tender department can change item lines." };
  const who = readSubmitter(formData);
  if (!who.ok) return { error: who.error };
  const tenderId = String(formData.get("tenderId") ?? "");
  const result = await saveTenderItems(getDb(), { companyId: user.companyId, tenderId, rows: readRows(formData) });
  if (!result.ok) return { error: result.error };
  await writeAudit({ companyId: user.companyId, userId: user.id, submittedBy: who.name, action: "tender.items_saved", entityType: "tender", entityId: tenderId, details: { lines: result.count } });
  refresh();
  const synced = [result.bidValue !== null ? "the bid value" : null, result.estimatedValue !== null ? "the estimated value" : null].filter(Boolean);
  return { saved: true, message: `${result.count} line${result.count === 1 ? "" : "s"} saved${synced.length ? `; ${synced.join(" and ")} now come${synced.length === 1 ? "s" : ""} from the lines` : ""}.` };
}
