import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { buildSalesByLine, sameDayLastYear, type LineSums } from "@/core/sales-by-line";

/** Year-to-date sales and margin by product line, against the same period last year. `today` is the Jordan business date. */
export async function companySalesByLine(companyId: string, today: string) {
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const priorStart = `${Number(today.slice(0, 4)) - 1}-01-01`;
  const priorEnd = sameDayLastYear(today);
  const r = await getDb().execute(sql`
    select p.line::text as line,
      case when i.invoice_date >= ${yearStart}::date then 'current' else 'prior' end as period,
      sum(s.net_sales)::text as sales,
      coalesce(sum(s.net_sales) filter (where s.product_cost is not null), 0)::text as costed_sales,
      coalesce(sum(s.product_cost), 0)::text as cost,
      count(*) filter (where s.product_cost is null)::int as without_cost
    from sales_lines s
    join invoices i on i.company_id = s.company_id and i.id = s.invoice_id
    left join products p on p.company_id = s.company_id and p.id = s.product_id
    where s.company_id = ${companyId}
      and ((i.invoice_date >= ${yearStart}::date and i.invoice_date <= ${today}::date)
        or (i.invoice_date >= ${priorStart}::date and i.invoice_date <= ${priorEnd}::date))
    group by 1, 2
  `);
  const sums: LineSums[] = (r.rows as Record<string, string | number>[]).map((x) => ({
    // No product on the line: the invoice came from an invoice-totals file.
    line: (x.line ?? null) as LineSums["line"],
    period: x.period as LineSums["period"],
    sales: Number(x.sales),
    costedSales: Number(x.costed_sales),
    cost: Number(x.cost),
    linesWithoutCost: Number(x.without_cost),
  }));
  return { ...buildSalesByLine(sums), from: yearStart, to: today, priorFrom: priorStart, priorTo: priorEnd };
}
