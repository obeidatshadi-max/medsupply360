import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/import-writer";
import { auditLogs, tenders, users } from "@/db/schema";
import { DATA_ACTIONS, areaOf, describeAction, isDataAction, type HistoryArea } from "@/core/data-history";

export type HistoryRow = {
  id: string;
  at: Date;
  /** The name typed on the form; null for records made before names were asked for. */
  submittedBy: string | null;
  /** The sign-in the change was made from, e.g. the tender department's account. */
  account: string | null;
  area: HistoryArea;
  text: string;
  tenderId: string | null;
  tenderTitle: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The newest data submissions of one company: who entered what, and when. Never reads another company's records. */
export async function listDataHistory(db: Db, companyId: string, limit = 200): Promise<HistoryRow[]> {
  const rows = await db
    .select({
      id: auditLogs.id,
      at: auditLogs.createdAt,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      details: auditLogs.details,
      submittedBy: auditLogs.submittedBy,
      account: users.fullName,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .where(and(eq(auditLogs.companyId, companyId), inArray(auditLogs.action, [...DATA_ACTIONS])))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  const tenderOf = (r: (typeof rows)[number]): string | null => {
    const id = r.entityType === "tender" ? r.entityId : typeof r.details?.tenderId === "string" ? r.details.tenderId : null;
    return id && UUID.test(id) ? id : null;
  };
  const ids = [...new Set(rows.map(tenderOf).filter((x): x is string => x !== null))];
  const titles = new Map<string, string>();
  if (ids.length) {
    for (const t of await db.select({ id: tenders.id, title: tenders.title }).from(tenders).where(and(eq(tenders.companyId, companyId), inArray(tenders.id, ids)))) titles.set(t.id, t.title);
  }

  return rows.filter((r) => isDataAction(r.action)).map((r) => {
    const action = r.action as (typeof DATA_ACTIONS)[number];
    const tenderId = tenderOf(r);
    return {
      id: r.id,
      at: r.at,
      submittedBy: r.submittedBy,
      account: r.account,
      area: areaOf(action),
      text: describeAction(action, r.details),
      tenderId: tenderId && titles.has(tenderId) ? tenderId : null,
      tenderTitle: tenderId ? (titles.get(tenderId) ?? null) : null,
    };
  });
}
