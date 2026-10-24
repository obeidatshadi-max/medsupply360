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
 * Like recentTotal, but one address adds at most `capPerIp`. A ceiling over all addresses still stops a spread-out
 * attack, yet a single address hammering the form cannot fill it and lock everyone else out.
 */
export async function recentTotalCappedPerIp(action: string, windowMinutes: number, capPerIp: number): Promise<number> {
  const since = sql`now() - make_interval(mins => ${windowMinutes})`;
  const result = await getDb().execute(sql`
    select coalesce(sum(least(n, ${capPerIp})), 0)::int as total from (
      select count(*) as n from audit_logs
      where action = ${action} and created_at > ${since}
      group by details->>'ip'
    ) per_ip`);
  return Number((result.rows[0] as { total: number } | undefined)?.total ?? 0);
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
