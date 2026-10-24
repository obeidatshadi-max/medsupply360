import "server-only";
import { and, gt, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { auditLogs } from "@/db/schema";

/** Counts every recent audit row of one action, whoever caused it. A global ceiling that rotating addresses cannot dodge. */
export async function recentTotal(action: string, windowMinutes: number): Promise<number> {
  const since = sql`now() - make_interval(mins => ${windowMinutes})`;
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(and(sql`${auditLogs.action} = ${action}`, gt(auditLogs.createdAt, since)));
  return row?.n ?? 0;
}

/**
 * Counts recent audit rows of one action, matched on details.email and/or details.ip. Using the audit log keeps the
 * limit consistent across serverless instances without a separate store.
 */
export async function recentCount(action: string, key: { email?: string; ip?: string | null }, windowMinutes: number): Promise<{ byEmail: number; byIp: number }> {
  const since = sql`now() - make_interval(mins => ${windowMinutes})`;
  const [row] = await getDb()
    .select({
      byEmail: key.email ? sql<number>`count(*) filter (where ${auditLogs.details}->>'email' = ${key.email})::int` : sql<number>`0`,
      byIp: key.ip ? sql<number>`count(*) filter (where ${auditLogs.details}->>'ip' = ${key.ip})::int` : sql<number>`0`,
    })
    .from(auditLogs)
    .where(and(sql`${auditLogs.action} = ${action}`, gt(auditLogs.createdAt, since)));
  return { byEmail: row?.byEmail ?? 0, byIp: row?.byIp ?? 0 };
}
