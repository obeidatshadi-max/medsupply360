import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { CHANNEL_INFO, type Channel, type ChannelStatus } from "@/core/channels";
import { SPECS } from "@/core/import/specs";

type Row = Record<string, unknown>;
const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : typeof v === "string" ? new Date(v).toISOString() : null);

/** Newest of several timestamps, as ISO text. */
const newest = (...dates: (string | null)[]): string | null => dates.filter((d): d is string => d !== null).sort().at(-1) ?? null;

/**
 * What each channel has received, for the hub. Counts what is stored for this company, never a guess: a channel with
 * nothing in it says so. Who updated it comes from the name typed on the form, and is empty for older records.
 */
export async function companyChannelStatus(companyId: string): Promise<Record<Channel, ChannelStatus>> {
  const db = getDb();
  const erpKinds = [...CHANNEL_INFO.erp.kinds];
  const manualKinds = [...CHANNEL_INFO.manual.kinds];
  const [batches, lastImport, tenderRow, lastTender, manualRow] = await Promise.all([
    db.execute(sql`select kind::text as kind, max(created_at) as at from import_batches
      where company_id = ${companyId} and rows_accepted > 0 and status in ('accepted', 'partial') group by kind`),
    db.execute(sql`select details->>'kind' as kind, submitted_by, created_at from audit_logs
      where company_id = ${companyId} and action = 'import.run' order by created_at desc limit 50`),
    db.execute(sql`select count(*)::int as total,
      count(*) filter (where status not in ('lost', 'cancelled', 'collected'))::int as open,
      max(updated_at) as at from tenders where company_id = ${companyId}`),
    db.execute(sql`select submitted_by, created_at from audit_logs
      where company_id = ${companyId} and action like 'tender.%' order by created_at desc limit 1`),
    db.execute(sql`select
      (select count(*)::int from installed_units where company_id = ${companyId}) as units,
      (select count(*)::int from sales_people where company_id = ${companyId} and active) as people,
      (select count(*)::int from sales_people where company_id = ${companyId} and active and monthly_sales_target is not null) as with_target,
      (select max(created_at) from sales_people where company_id = ${companyId}) as people_at`),
  ]);

  const loaded = new Map((batches.rows as Row[]).map((r) => [String(r.kind), iso(r.at)]));
  const byKinds = (kinds: readonly string[]) => (lastImport.rows as Row[]).find((r) => kinds.includes(String(r.kind)));

  const erpLoaded = erpKinds.filter((k) => loaded.has(k));
  const erp: ChannelStatus = {
    channel: "erp",
    lastUpdate: newest(...erpKinds.map((k) => loaded.get(k) ?? null)),
    by: (byKinds(erpKinds)?.submitted_by as string | null | undefined) ?? null,
    facts: [`${erpLoaded.length} of ${erpKinds.length} file types loaded`],
    missing: erpKinds.filter((k) => !loaded.has(k)).map((k) => SPECS[k].title),
  };

  const t = tenderRow.rows[0] as Row;
  const tenders = Number(t.total);
  const tender: ChannelStatus = {
    channel: "tender",
    lastUpdate: newest(iso(t.at), iso((lastTender.rows[0] as Row | undefined)?.created_at)),
    by: ((lastTender.rows[0] as Row | undefined)?.submitted_by as string | null | undefined) ?? null,
    facts: tenders === 0 ? [] : [`${tenders} tender${tenders === 1 ? "" : "s"}, ${Number(t.open)} still open`],
    missing: tenders === 0 ? ["No tenders recorded"] : [],
  };

  const m = manualRow.rows[0] as Row;
  const units = Number(m.units);
  const people = Number(m.people);
  const withTarget = Number(m.with_target);
  const manual: ChannelStatus = {
    channel: "manual",
    lastUpdate: newest(...manualKinds.map((k) => loaded.get(k) ?? null), iso(m.people_at)),
    by: (byKinds(manualKinds)?.submitted_by as string | null | undefined) ?? null,
    facts: [`${units} installed unit${units === 1 ? "" : "s"}`, `${people} sales ${people === 1 ? "person" : "people"}`],
    missing: [
      ...(units === 0 ? ["No installed equipment"] : []),
      ...(people === 0 ? ["No sales force"] : people > withTarget ? [`${people - withTarget} sales ${people - withTarget === 1 ? "person has" : "people have"} no monthly target`] : []),
    ],
  };

  return { erp, tender, manual };
}
