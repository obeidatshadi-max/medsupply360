import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { change, weekWindows } from "@/core/weekly";
import { companyReceivables, lastTwoReceivableSnapshots } from "@/lib/receivables";

/**
 * What changed in the last 7 days against the 7 before, from imported data. `today` is the Jordan business date.
 * Each week ends at the newest date in its own file (pass `windowEnd(today, latest)`), so a stale import compares its
 * last two real weeks instead of showing zeros. Sales and cash can end on different days.
 */
export async function companyWeekly(companyId: string, today: string, ends: { sales?: string; cash?: string } = {}) {
  const w = weekWindows(ends.sales ?? today);
  const wc = weekWindows(ends.cash ?? today);
  const db = getDb();

  const flows = await db.execute(sql`
    select
      (select coalesce(sum(s.net_sales) filter (where i.invoice_date between ${w.thisFrom}::date and ${w.thisTo}::date), 0)::text
         from sales_lines s join invoices i on i.company_id = s.company_id and i.id = s.invoice_id where s.company_id = ${companyId}) as sales_now,
      (select coalesce(sum(s.net_sales) filter (where i.invoice_date between ${w.prevFrom}::date and ${w.prevTo}::date), 0)::text
         from sales_lines s join invoices i on i.company_id = s.company_id and i.id = s.invoice_id where s.company_id = ${companyId}) as sales_before,
      (select coalesce(sum(allocated_amount) filter (where receipt_date between ${wc.thisFrom}::date and ${wc.thisTo}::date), 0)::text from receipts where company_id = ${companyId}) as cash_now,
      (select coalesce(sum(allocated_amount) filter (where receipt_date between ${wc.prevFrom}::date and ${wc.prevTo}::date), 0)::text from receipts where company_id = ${companyId}) as cash_before,
      (select count(distinct i.id)::int from invoices i join sales_lines s on s.company_id = i.company_id and s.invoice_id = i.id
         where i.company_id = ${companyId} and i.invoice_date between ${w.thisFrom}::date and ${w.thisTo}::date and s.net_sales > 0) as orders_now,
      (select count(distinct i.id)::int from invoices i join sales_lines s on s.company_id = i.company_id and s.invoice_id = i.id
         where i.company_id = ${companyId} and i.invoice_date between ${w.prevFrom}::date and ${w.prevTo}::date and s.net_sales > 0) as orders_before
  `);
  const f = flows.rows[0] as Record<string, string | number>;

  const top = await db.execute(sql`
    select c.code, c.name, sum(s.net_sales)::text as sales
    from sales_lines s join invoices i on i.company_id = s.company_id and i.id = s.invoice_id
    join customers c on c.company_id = i.company_id and c.id = i.customer_id
    where s.company_id = ${companyId} and i.invoice_date between ${w.thisFrom}::date and ${w.thisTo}::date
    group by c.code, c.name having sum(s.net_sales) > 0 order by sum(s.net_sales) desc, c.code limit 5
  `);

  const imports = await db.execute(sql`
    select kind::text as kind, max(created_at) as at from import_batches
    where company_id = ${companyId} and status in ('accepted', 'partial') and created_at > now() - interval '7 days' group by kind order by 2 desc
  `);

  const snaps = await lastTwoReceivableSnapshots(companyId);
  let overdue: { now: ReturnType<typeof change>; nowAsOf: string; beforeAsOf: string } | null = null;
  if (snaps.length === 2) {
    const [cur, prev] = await Promise.all([companyReceivables(companyId, 0, snaps[0]), companyReceivables(companyId, 0, snaps[1])]);
    if (cur && prev) overdue = { now: change(cur.overdue, prev.overdue), nowAsOf: snaps[0]!, beforeAsOf: snaps[1]! };
  }

  return {
    windows: w,
    cashWindows: wc,
    sales: change(Number(f.sales_now), Number(f.sales_before)),
    cash: change(Number(f.cash_now), Number(f.cash_before)),
    orders: change(Number(f.orders_now), Number(f.orders_before)),
    topCustomers: (top.rows as Record<string, string>[]).map((x) => ({ code: String(x.code), name: String(x.name), sales: Number(x.sales) })),
    importsThisWeek: (imports.rows as { kind: string; at: Date | string }[]).map((x) => ({ kind: x.kind, at: new Date(x.at) })),
    overdue,
  };
}
