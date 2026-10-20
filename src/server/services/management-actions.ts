import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/import-writer";
import { managementActions } from "@/db/schema";
import { isUuid } from "@/core/sales-force";
import { cleanAction, type ActionForm, type ActionStatus } from "@/core/management-actions";

export type ActionItem = {
  id: string;
  title: string;
  evidence: string | null;
  responsible: string;
  due: string;
  status: ActionStatus;
  createdBy: string | null;
  completedOn: string | null;
  completedBy: string | null;
};

export type ActionOutcome = { ok: true; id: string } | { ok: false; error: string };
const NOT_FOUND = "That action was not found.";

/** One company's actions. Never reads another company's rows. */
export async function listActions(db: Db, companyId: string): Promise<ActionItem[]> {
  const rows = await db.select().from(managementActions).where(eq(managementActions.companyId, companyId)).orderBy(asc(managementActions.due), asc(managementActions.createdAt));
  return rows.map((r) => ({ id: r.id, title: r.title, evidence: r.evidence, responsible: r.responsible, due: r.due, status: r.status, createdBy: r.createdBy, completedOn: r.completedOn, completedBy: r.completedBy }));
}

export async function addAction(db: Db, input: { companyId: string; form: ActionForm; by: string }): Promise<ActionOutcome> {
  const c = cleanAction(input.form);
  if (!c.ok) return c;
  const v = c.value;
  const [row] = await db
    .insert(managementActions)
    .values({ companyId: input.companyId, title: v.title, evidence: v.evidence, responsible: v.responsible, due: v.due, createdBy: input.by })
    .returning({ id: managementActions.id });
  return { ok: true, id: row!.id };
}

/** Confirms an action as done (with the day and who), or reopens it. Reopening clears the completion. */
export async function setActionDone(db: Db, input: { companyId: string; id: string; done: boolean; by: string; today: string }): Promise<ActionOutcome> {
  if (!isUuid(input.id)) return { ok: false, error: NOT_FOUND };
  const set = input.done
    ? { status: "done" as const, completedOn: input.today, completedBy: input.by, updatedAt: sql`now()` }
    : { status: "open" as const, completedOn: null, completedBy: null, updatedAt: sql`now()` };
  const changed = await db.update(managementActions).set(set).where(and(eq(managementActions.companyId, input.companyId), eq(managementActions.id, input.id))).returning({ id: managementActions.id });
  return changed.length ? { ok: true, id: input.id } : { ok: false, error: NOT_FOUND };
}

export async function removeAction(db: Db, input: { companyId: string; id: string }): Promise<ActionOutcome> {
  if (!isUuid(input.id)) return { ok: false, error: NOT_FOUND };
  const gone = await db.delete(managementActions).where(and(eq(managementActions.companyId, input.companyId), eq(managementActions.id, input.id))).returning({ id: managementActions.id });
  return gone.length ? { ok: true, id: input.id } : { ok: false, error: NOT_FOUND };
}
