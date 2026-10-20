import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { companyInstalledBase } from "@/lib/installed-base";

export type LinkedConsumable = { code: string; name: string; sales: number };

/**
 * One installed machine in full: its customer's combined expectation and purchases (sales are recorded per customer),
 * the product it is, and the consumables the customer bought in the same 90-day window, biggest first.
 */
export async function companyUnitDetail(companyId: string, code: string, today: string) {
  const base = await companyInstalledBase(companyId, today, null);
  const account = base.accounts.find((a) => a.units.some((u) => u.code === code));
  const unit = account?.units.find((u) => u.code === code);
  if (!account || !unit) return null;

  const db = getDb();
  const [product, linked] = await Promise.all([
    db.execute(sql`
      select p.code, p.name, p.line::text as line, p.supplier_name, p.manufacturer
      from installed_units u join products p on p.company_id = u.company_id and p.id = u.product_id
      where u.company_id = ${companyId} and u.code = ${code}`),
    db.execute(sql`
      select p.code, p.name, sum(s.net_sales)::text as sales
      from sales_lines s
      join invoices i on i.company_id = s.company_id and i.id = s.invoice_id
      join products p on p.company_id = s.company_id and p.id = s.product_id
      join customers c on c.company_id = i.company_id and c.id = i.customer_id
      where s.company_id = ${companyId} and c.code = ${account.customerCode} and p.line = 'Consumables'
        and i.invoice_date >= ${base.window.from}::date and i.invoice_date <= ${base.window.to}::date
      group by p.code, p.name
      having sum(s.net_sales) <> 0
      order by sum(s.net_sales) desc
      limit 5`),
  ]);
  const p = product.rows[0] as { code: string; name: string; line: string; supplier_name: string | null; manufacturer: string | null } | undefined;
  return {
    unit,
    account,
    window: base.window,
    product: p ? { code: p.code, name: p.name, line: p.line, supplier: p.supplier_name, manufacturer: p.manufacturer } : null,
    linked: (linked.rows as { code: string; name: string; sales: string }[]).map<LinkedConsumable>((r) => ({ code: r.code, name: r.name, sales: Number(r.sales) })),
    otherUnits: account.units.filter((u) => u.code !== code),
  };
}
