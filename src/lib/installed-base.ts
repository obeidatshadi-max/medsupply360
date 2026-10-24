import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { HISTORY_MONTHS, deriveUnits, earlierMonthlyNorm, mergeUnits, type EarlierPurchases, type SoldGroup } from "@/core/derived-units";
import { windowEnd } from "@/core/freshness";
import { buildInstalledBase, type ServiceStatus, type UnitInput } from "@/core/installed-base";
import { unitInLine } from "@/core/line-filter";
import type { Line } from "@/core/sales-by-line";
import { addDays } from "@/lib/format";

/** Days of purchases that set what a customer "actually" buys per month. Ninety days smooths one-off orders without going stale. */
export const PURCHASE_WINDOW_DAYS = 90;

/** Machines the owner described by hand (Data, Manual entry), with the product they are when there is one. */
async function describedUnits(companyId: string): Promise<UnitInput[]> {
  const rows = await getDb().execute(sql`
    select u.code, u.name, p.line::text as line, p.code as product_code, c.code as customer_code, c.name as customer_name,
      u.installed_on::text as installed_on, u.warranty_end::text as warranty_end, u.service::text as service,
      u.expected_monthly_consumables::text as expected
    from installed_units u join customers c on c.company_id = u.company_id and c.id = u.customer_id
      left join products p on p.company_id = u.company_id and p.id = u.product_id
    where u.company_id = ${companyId}`);
  return (rows.rows as Record<string, string | null>[]).map((r) => ({
    code: String(r.code),
    line: r.line as Line | null,
    productCode: r.product_code,
    source: "manual" as const,
    name: String(r.name),
    customerCode: String(r.customer_code),
    customerName: String(r.customer_name),
    installedOn: r.installed_on,
    warrantyEnd: r.warranty_end,
    service: r.service as ServiceStatus | null,
    expectedMonthly: r.expected === null ? null : Number(r.expected),
  }));
}

/** Equipment and devices sold to each customer, from the imported sales (returns taken off). */
async function soldGroups(companyId: string): Promise<SoldGroup[]> {
  const rows = await getDb().execute(sql`
    select c.code as customer_code, c.name as customer_name, p.code as product_code, p.name as product_name, p.line::text as line,
      sum(s.quantity)::text as net_quantity, min(i.invoice_date) filter (where s.quantity > 0)::text as first_sale
    from sales_lines s
    join invoices i on i.company_id = s.company_id and i.id = s.invoice_id
    join products p on p.company_id = s.company_id and p.id = s.product_id
    join customers c on c.company_id = i.company_id and c.id = i.customer_id
    where s.company_id = ${companyId} and p.line in ('Equipment', 'Devices')
    group by c.code, c.name, p.code, p.name, p.line
    having sum(s.quantity) >= 1`);
  return (rows.rows as Record<string, string | null>[]).map((r) => ({
    customerCode: String(r.customer_code),
    customerName: String(r.customer_name),
    productCode: String(r.product_code),
    productName: String(r.product_name),
    line: r.line as "Equipment" | "Devices",
    netQuantity: Number(r.net_quantity),
    firstSale: r.first_sale,
  }));
}

/**
 * Every installed machine of one company: the equipment and devices already in the imported sales, with what the owner
 * has described in Data, Manual entry laid over them. Nothing has to be typed twice.
 */
export async function companyInstalledUnits(companyId: string, line: Line | null = null): Promise<UnitInput[]> {
  const [sold, described] = await Promise.all([soldGroups(companyId), describedUnits(companyId)]);
  return mergeUnits(deriveUnits(sold), described).filter((u) => unitInLine(u.line ?? null, line));
}

/**
 * The installed base of one company against the consumables its customers bought in the 90 days up to the newest
 * invoice (never later than today). Consumables are the product lines marked Consumables; returns are taken off.
 * Where the owner typed no estimate, a customer who bought regularly before that is held to its own earlier norm.
 */
export async function companyInstalledBase(companyId: string, today: string, line: Line | null = null) {
  const db = getDb();
  const [units, latest] = await Promise.all([
    companyInstalledUnits(companyId, line),
    db.execute(sql`select max(invoice_date)::text as d from invoices where company_id = ${companyId} and invoice_date <= ${today}::date`),
  ]);
  const to = windowEnd(today, (latest.rows[0] as { d: string | null } | undefined)?.d ?? null);
  const from = addDays(to, -(PURCHASE_WINDOW_DAYS - 1));
  const earlierTo = addDays(from, -1);
  const earlierFrom = addDays(earlierTo, -(HISTORY_MONTHS * 30 - 1));
  const codes = new Set(units.map((u) => u.customerCode));

  const bought = new Map<string, number>();
  let norm = new Map<string, number>();
  if (units.length > 0) {
    const [recent, earlier] = await Promise.all([
      db.execute(sql`
        select c.code, sum(s.net_sales)::text as sales
        from sales_lines s
        join invoices i on i.company_id = s.company_id and i.id = s.invoice_id
        join products p on p.company_id = s.company_id and p.id = s.product_id
        join customers c on c.company_id = i.company_id and c.id = i.customer_id
        where s.company_id = ${companyId} and p.line = 'Consumables'
          and i.invoice_date >= ${from}::date and i.invoice_date <= ${to}::date
        group by c.code`),
      db.execute(sql`
        select c.code as customer_code, sum(s.net_sales)::text as sales, count(distinct date_trunc('month', i.invoice_date))::int as months
        from sales_lines s
        join invoices i on i.company_id = s.company_id and i.id = s.invoice_id
        join products p on p.company_id = s.company_id and p.id = s.product_id
        join customers c on c.company_id = i.company_id and c.id = i.customer_id
        where s.company_id = ${companyId} and p.line = 'Consumables'
          and i.invoice_date >= ${earlierFrom}::date and i.invoice_date <= ${earlierTo}::date
        group by c.code`),
    ]);
    for (const r of recent.rows as { code: string; sales: string }[]) if (codes.has(r.code)) bought.set(r.code, (Number(r.sales) * 30) / PURCHASE_WINDOW_DAYS);
    const rows: EarlierPurchases[] = (earlier.rows as { customer_code: string; sales: string; months: number }[])
      .filter((r) => codes.has(r.customer_code))
      .map((r) => ({ customerCode: r.customer_code, sales: Number(r.sales), monthsWithSales: Number(r.months) }));
    norm = earlierMonthlyNorm(rows);
  }

  return { ...buildInstalledBase(units, bought, today, norm), window: { from, to }, earlierWindow: { from: earlierFrom, to: earlierTo }, today };
}
