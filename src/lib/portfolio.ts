import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { buildPortfolio, type AreaCoverage, type SalesRow } from "@/core/portfolio";
import { sameDayLastYear, type Line } from "@/core/sales-by-line";

/** Year-to-date sales by therapeutic area and customer type against the same dates last year. `today` is the Jordan business date. */
export async function companyPortfolio(companyId: string, today: string, line: Line | null = null) {
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const priorStart = `${Number(today.slice(0, 4)) - 1}-01-01`;
  const priorEnd = sameDayLastYear(today);
  const db = getDb();

  const r = await db.execute(sql`
    select p.therapeutic_area as area, c.segment::text as segment, c.code as customer,
      case when i.invoice_date >= ${yearStart}::date then 'current' else 'prior' end as period,
      sum(s.net_sales)::text as sales
    from sales_lines s
    join invoices i on i.company_id = s.company_id and i.id = s.invoice_id
    join customers c on c.company_id = i.company_id and c.id = i.customer_id
    join products p on p.company_id = s.company_id and p.id = s.product_id
    where s.company_id = ${companyId} and (${line}::text is null or p.line::text = ${line}::text)
      and ((i.invoice_date >= ${yearStart}::date and i.invoice_date <= ${today}::date)
        or (i.invoice_date >= ${priorStart}::date and i.invoice_date <= ${priorEnd}::date))
    group by 1, 2, 3, 4
  `);
  const rows: SalesRow[] = (r.rows as Record<string, string | null>[]).map((x) => ({
    area: x.area,
    segment: x.segment,
    customer: String(x.customer),
    period: x.period as SalesRow["period"],
    sales: Number(x.sales),
  }));
  if (rows.length === 0) return null;

  const cov = await db.execute(sql`
    select therapeutic_area as area, count(*)::int as products, count(distinct supplier_code)::int as suppliers
    from products where company_id = ${companyId} and active and therapeutic_area is not null
    group by therapeutic_area
  `);
  const coverage: AreaCoverage[] = (cov.rows as Record<string, string | number>[]).map((x) => ({
    area: String(x.area),
    activeProducts: Number(x.products),
    suppliers: Number(x.suppliers),
  }));

  return { ...buildPortfolio(rows, coverage), from: yearStart, to: today, priorFrom: priorStart, priorTo: priorEnd };
}
