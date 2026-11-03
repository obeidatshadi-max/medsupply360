import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";

type Row = Record<string, unknown>;
const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : typeof v === "string" ? new Date(v).toISOString() : null);

/**
 * When the service data (the installed equipment file or the details typed on a machine) last changed, and the name typed on the
 * form. A fully rejected file does not count.
 */
export async function lastServiceUpdate(companyId: string): Promise<{ lastUpdate: string | null; by: string | null }> {
  const db = getDb();
  const [batch, audit] = await Promise.all([
    db.execute(sql`select max(created_at) as at from import_batches where company_id = ${companyId} and kind = 'installed_units' and rows_accepted > 0 and status in ('accepted', 'partial')`),
    db.execute(sql`select submitted_by, created_at from audit_logs where company_id = ${companyId}
      and (action = 'machine.details_saved' or (action = 'import.run' and details->>'kind' = 'installed_units')) order by created_at desc limit 1`),
  ]);
  const a = audit.rows[0] as Row | undefined;
  const times = [iso((batch.rows[0] as Row).at), iso(a?.created_at)].filter((t): t is string => t !== null).sort();
  return { lastUpdate: times.at(-1) ?? null, by: (a?.submitted_by as string | null | undefined) ?? null };
}
