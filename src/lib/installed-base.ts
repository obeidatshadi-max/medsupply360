import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { windowEnd } from "@/core/freshness";
import { buildInstalledBase, type ServiceStatus, type UnitInput } from "@/core/installed-base";
import { addDays } from "@/lib/format";

/** Days of purchases that set what a customer "actually" buys per month. Ninety days smooths one-off orders without going stale. */
export const PURCHASE_WINDOW_DAYS = 90;

/** Every installed unit of one company with its customer, as recorded on the equipment list. */
export async function companyInstalledUnits(companyId: string): Promise<UnitInput[]> {
  const rows = await getDb().execute(sql`
    select u.code, u.name, c.code as customer_code, c.name as customer_name, u.installed_on::text as installed_on,
      u.warranty_end::text as warranty_end, u.service::text as service, u.expected_monthly_consumables::text as expected
    from installed_units u join customers c on c.company_id = u.company_id and c.id = u.customer_id
    where u.company_id = ${companyId}`);
  return (rows.rows as Record<string, string | null>[]).map((r) => ({
    code: String(r.code),
    name: String(r.name),
    customerCode: String(r.customer_code),
    customerName: String(r.customer_name),
    installedOn: r.installed_on,
    warrantyEnd: r.warranty_end,
    service: r.service as ServiceStatus | null,
    expectedMonthly: r.expected === null ? null : Number(r.expected),
  }));
}

/**
 * The installed base of one company against the consumables its customers bought in the 90 days up to the newest
 * invoice (never later than today). Consumables are the product lines marked Consumables; returns are taken off.
 */
export async function companyInstalledBase(companyId: string, today: string) {
  const db = getDb();
  const [units, latest] = await Promise.all([
    companyInstalledUnits(companyId),
    db.execute(sql`select max(invoice_date)::text as d from invoices where company_id = ${companyId} and invoice_date <= ${today}::date`),
  ]);
  const to = windowEnd(today, (latest.rows[0] as { d: string | null } | undefined)?.d ?? null);
  const from = addDays(to, -(PURCHASE_WINDOW_DAYS - 1));

  const bought = new Map<string, number>();
  if (units.length > 0) {
    const sales = await db.execute(sql`
      select c.code, sum(s.net_sales)::text as sales
      from sales_lines s
      join invoices i on i.company_id = s.company_id and i.id = s.invoice_id
      join products p on p.company_id = s.company_id and p.id = s.product_id
      join customers c on c.company_id = i.company_id and c.id = i.customer_id
      where s.company_id = ${companyId} and p.line = 'Consumables'
        and i.invoice_date >= ${from}::date and i.invoice_date <= ${to}::date
        and c.id in (select customer_id from installed_units where company_id = ${companyId})
      group by c.code`);
    for (const r of sales.rows as { code: string; sales: string }[]) bought.set(r.code, (Number(r.sales) * 30) / PURCHASE_WINDOW_DAYS);
  }

  return { ...buildInstalledBase(units, bought, today), window: { from, to }, today };
}
