import "server-only";
import { getDb } from "@/db/client";
import { auditLogs } from "@/db/schema";

export async function writeAudit(entry: {
  companyId?: string | null;
  userId: string | null;
  /** The person's typed name, when the action was a data submission. */
  submittedBy?: string | null;
  action: string;
  entityType?: string;
  entityId?: string | number;
  details?: Record<string, unknown>;
}): Promise<void> {
  await getDb()
    .insert(auditLogs)
    .values({
      companyId: entry.companyId ?? null,
      userId: entry.userId,
      submittedBy: entry.submittedBy ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId === undefined ? undefined : String(entry.entityId),
      details: entry.details,
    });
}
