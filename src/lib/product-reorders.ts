import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { buildProductReorders, type ProductOrder } from "@/core/product-reorders";

/** Company-scoped invoice/product history. Credits are not new demand; sums retain original ERP units. */
export async function companyProductReorders(companyId: string, today: string) {
  const db = getDb();
  const r = await db.execute(sql`
    select c.code as customer_code, c.name as customer_name, c.segment,
      p.code as product_code, p.name as product_name, p.line as category, p.unit,
      i.invoice_date::text as date, sum(s.quantity)::text as quantity, sum(s.net_sales)::text as value
    from sales_lines s
    join invoices i on i.company_id = s.company_id and i.id = s.invoice_id
    join customers c on c.company_id = i.company_id and c.id = i.customer_id
    join products p on p.company_id = s.company_id and p.id = s.product_id
    where s.company_id = ${companyId} and i.invoice_date <= ${today}::date
      and s.doc_type = 'invoice' and s.quantity > 0 and s.net_sales > 0
    group by c.code, c.name, c.segment, p.code, p.name, p.line, p.unit, i.invoice_date
  `);
  const rows: ProductOrder[] = (r.rows as Record<string, string | null>[]).map((x) => ({
    customerCode: String(x.customer_code), customerName: String(x.customer_name), productCode: String(x.product_code),
    productName: String(x.product_name), segment: x.segment, category: String(x.category), unit: x.unit,
    date: String(x.date), quantity: Number(x.quantity), value: Number(x.value),
  }));
  const latest = await db.execute(sql`
    select status, created_at::text as imported_at from import_batches
    where company_id = ${companyId} and kind = 'sales' and rows_accepted > 0
    order by created_at desc limit 1
  `);
  const batch = latest.rows[0] as { status: string; imported_at: string } | undefined;
  return { ...buildProductReorders(rows, today), latestImport: batch?.imported_at ?? null, partialImport: batch?.status === "partial" };
}
