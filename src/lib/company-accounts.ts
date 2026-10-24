import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { isIsoDate, roundJod } from "@/core/calc";
import type { Line } from "@/core/sales-by-line";

export type CompanyAccountView = "all" | "private" | "tender";
export interface CompanyAccount {
  code: string;
  name: string;
  segment: string | null;
  /** The sales person the owner assigned on Sales force; when none, the owner name from the imported customer file. */
  owner: string | null;
  /** The assigned sales person's id, for linking to their page; null when the owner is only the customer-file name. */
  ownerId: string | null;
  /** Owner name as written in the imported customer file, kept so a disagreement with the assignment is visible. */
  importedOwner: string | null;
  city: string | null;
  active: boolean;
  sales: number | null;
  /** Sales on lines that carry a product cost; the part of `sales` that `grossProfit` covers. */
  costedSales: number;
  /**
   * Profit on the costed lines only, as on the Overview. Null when the account has sales but no cost on any line;
   * zero when it has no sales lines at all.
   */
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
export async function companyAccounts(companyId: string, today: string, view: CompanyAccountView = "all", search = "", salesTo = today, line: Line | null = null) {
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
        coalesce(sum(s.net_sales) filter(where i.invoice_date >= ${from}::date and s.product_cost is not null), 0) as costed_sales,
        coalesce(sum(s.product_cost) filter(where i.invoice_date >= ${from}::date), 0) as cost,
        count(*) filter(where i.invoice_date >= ${from}::date and s.product_cost is null)::int as missing_cost,
        max(i.invoice_date) filter(where s.doc_type = 'invoice' and s.quantity > 0 and s.net_sales > 0) as last_order
      from sales_lines s
      join invoices i on i.company_id = s.company_id and i.id = s.invoice_id
      join products p on p.company_id = s.company_id and p.id = s.product_id
      where s.company_id = ${companyId} and i.invoice_date <= ${salesTo}::date
        and (${line}::text is null or p.line::text = ${line}::text)
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
    select c.code, c.name, c.segment, c.account_owner, sp.name as assigned_owner, sp.id::text as assigned_owner_id, c.city, c.active,
      x.has_sales, x.snapshot_date::text,
      coalesce(s.sales, 0)::text as sales, coalesce(s.costed_sales, 0)::text as costed_sales, coalesce(s.cost, 0)::text as cost,
      coalesce(s.missing_cost, 0)::int as missing_cost, s.last_order::text,
      coalesce(b.outstanding, 0)::text as outstanding, coalesce(b.overdue, 0)::text as overdue,
      coalesce(b.unaged, 0)::int as unaged
    from customers c cross join context x
    left join sales s on s.customer_id = c.id
    left join balances b on b.customer_id = c.id
    left join sales_people sp on sp.company_id = c.company_id and sp.id = c.sales_person_id
    where c.company_id = ${companyId}
    order by c.name, c.code
  `);
  const source = result.rows as Record<string, unknown>[];
  const hasSales = source[0]?.has_sales === true;
  const snapshotDate = source[0]?.snapshot_date == null ? null : String(source[0].snapshot_date);
  const text = (v: unknown) => v == null ? null : String(v);
  const accounts: CompanyAccount[] = source.map((r) => ({
    code: String(r.code), name: String(r.name), segment: text(r.segment), owner: text(r.assigned_owner) ?? text(r.account_owner), ownerId: text(r.assigned_owner_id), importedOwner: text(r.account_owner), city: text(r.city), active: r.active === true,
    sales: hasSales ? Number(r.sales) : null,
    costedSales: roundJod(Number(r.costed_sales)),
    grossProfit: !hasSales ? null : Number(r.costed_sales) !== 0 || Number(r.cost) !== 0 ? roundJod(Number(r.costed_sales) - Number(r.cost)) : Number(r.missing_cost) === 0 ? 0 : null,
    linesWithoutCost: Number(r.missing_cost), lastOrder: text(r.last_order),
    outstanding: snapshotDate ? Number(r.outstanding) : null, overdue: snapshotDate ? Number(r.overdue) : null,
    unagedInvoices: Number(r.unaged),
  }));
  const query = search.trim().slice(0, 200).toLocaleLowerCase();
  const matched = accounts.filter((r) => (view === "all" || r.segment?.toLowerCase() === view)
    && (!query || [r.code, r.name, r.city, r.owner, r.importedOwner].some((v) => v?.toLocaleLowerCase().includes(query))));
  const sum = (key: "sales" | "outstanding" | "overdue") =>
    matched.length > 0 && matched.every((r) => r[key] !== null) ? roundJod(matched.reduce((total, r) => total + (r[key] ?? 0), 0)) : null;
  // Gross profit follows the Overview: profit on costed lines, with the share of sales that covers. Accounts whose
  // lines carry no cost are left out of the profit but stay in the sales, so the coverage shows the gap.
  const costed = matched.filter((r) => r.grossProfit !== null);
  const totalSales = sum("sales");
  const grossProfit = costed.length > 0 ? roundJod(costed.reduce((total, r) => total + (r.grossProfit ?? 0), 0)) : null;
  const costCoverage = totalSales !== null && totalSales > 0 && grossProfit !== null ? Math.min(1, matched.reduce((total, r) => total + r.costedSales, 0) / totalSales) : null;
  return { from, to: salesTo, snapshotDate, hasSales, search: search.trim().slice(0, 200), totalAccounts: accounts.length,
    matchedCount: matched.length, rows: matched.slice(0, 200),
    summary: { sales: totalSales, grossProfit, costCoverage, outstanding: sum("outstanding"), overdue: sum("overdue") } };
}
