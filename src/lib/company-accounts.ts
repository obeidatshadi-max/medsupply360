import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { isIsoDate, roundJod } from "@/core/calc";

export type CompanyAccountView = "all" | "private" | "tender";
export interface CompanyAccount {
  code: string;
  name: string;
  segment: string | null;
  owner: string | null;
  city: string | null;
  active: boolean;
  sales: number | null;
  grossProfit: number | null;
  linesWithoutCost: number;
  outstanding: number | null;
  overdue: number | null;
  unagedInvoices: number;
  lastOrder: string | null;
}

/**
 * Separate aggregates avoid multiplying sales by invoice balances. Every join and source is company-scoped.
 * `salesTo` ends the year-to-date sales window (pass `windowEnd(today, latestInvoice)` so it matches the Overview);
 * the unpaid-invoice snapshot is still the newest one up to `today`.
 */
export async function companyAccounts(companyId: string, today: string, view: CompanyAccountView = "all", search = "", salesTo = today) {
  if (!isIsoDate(today) || !isIsoDate(salesTo)) throw new RangeError("Invalid accounts date");
  const from = `${salesTo.slice(0, 4)}-01-01`;
  const result = await getDb().execute(sql`
    with context as (
      select
        exists(select 1 from sales_lines s join invoices i on i.company_id = s.company_id and i.id = s.invoice_id
          where s.company_id = ${companyId} and i.invoice_date <= ${salesTo}::date) as has_sales,
        (select max(snapshot_date) from open_invoice_snapshots where company_id = ${companyId}
          and snapshot_date <= ${today}::date) as snapshot_date
    ), sales as (
      select i.customer_id,
        coalesce(sum(s.net_sales) filter(where i.invoice_date >= ${from}::date), 0) as sales,
        coalesce(sum(s.product_cost) filter(where i.invoice_date >= ${from}::date), 0) as cost,
        count(*) filter(where i.invoice_date >= ${from}::date and s.product_cost is null)::int as missing_cost,
        max(i.invoice_date) filter(where s.doc_type = 'invoice' and s.quantity > 0 and s.net_sales > 0) as last_order
      from sales_lines s
      join invoices i on i.company_id = s.company_id and i.id = s.invoice_id
      where s.company_id = ${companyId} and i.invoice_date <= ${salesTo}::date
      group by i.customer_id
    ), balances as (
      select i.customer_id, sum(o.remaining_amount) as outstanding,
        coalesce(sum(o.remaining_amount) filter(where o.remaining_amount > 0 and i.due_date < o.snapshot_date), 0) as overdue,
        count(*) filter(where o.remaining_amount > 0 and i.due_date is null)::int as unaged
      from open_invoice_snapshots o
      join invoices i on i.company_id = o.company_id and i.id = o.invoice_id
      where o.company_id = ${companyId} and o.snapshot_date = (select snapshot_date from context)
      group by i.customer_id
    )
    select c.code, c.name, c.segment, c.account_owner, c.city, c.active,
      x.has_sales, x.snapshot_date::text,
      coalesce(s.sales, 0)::text as sales, coalesce(s.cost, 0)::text as cost,
      coalesce(s.missing_cost, 0)::int as missing_cost, s.last_order::text,
      coalesce(b.outstanding, 0)::text as outstanding, coalesce(b.overdue, 0)::text as overdue,
      coalesce(b.unaged, 0)::int as unaged
    from customers c cross join context x
    left join sales s on s.customer_id = c.id
    left join balances b on b.customer_id = c.id
    where c.company_id = ${companyId}
    order by c.name, c.code
  `);
  const source = result.rows as Record<string, unknown>[];
  const hasSales = source[0]?.has_sales === true;
  const snapshotDate = source[0]?.snapshot_date == null ? null : String(source[0].snapshot_date);
  const text = (v: unknown) => v == null ? null : String(v);
  const accounts: CompanyAccount[] = source.map((r) => ({
    code: String(r.code), name: String(r.name), segment: text(r.segment), owner: text(r.account_owner), city: text(r.city), active: r.active === true,
    sales: hasSales ? Number(r.sales) : null,
    grossProfit: hasSales && Number(r.missing_cost) === 0 ? roundJod(Number(r.sales) - Number(r.cost)) : null,
    linesWithoutCost: Number(r.missing_cost), lastOrder: text(r.last_order),
    outstanding: snapshotDate ? Number(r.outstanding) : null, overdue: snapshotDate ? Number(r.overdue) : null,
    unagedInvoices: Number(r.unaged),
  }));
  const query = search.trim().slice(0, 200).toLocaleLowerCase();
  const matched = accounts.filter((r) => (view === "all" || r.segment?.toLowerCase() === view)
    && (!query || [r.code, r.name, r.city, r.owner].some((v) => v?.toLocaleLowerCase().includes(query))));
  const sum = (key: "sales" | "grossProfit" | "outstanding" | "overdue") =>
    matched.length > 0 && matched.every((r) => r[key] !== null) ? roundJod(matched.reduce((total, r) => total + (r[key] ?? 0), 0)) : null;
  return { from, to: salesTo, snapshotDate, hasSales, search: search.trim().slice(0, 200), totalAccounts: accounts.length,
    matchedCount: matched.length, rows: matched.slice(0, 200),
    summary: { sales: sum("sales"), grossProfit: sum("grossProfit"), outstanding: sum("outstanding"), overdue: sum("overdue") } };
}
