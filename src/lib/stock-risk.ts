import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { buildStockRisk, type StockBatch } from "@/core/stock-risk";
import type { Line } from "@/core/sales-by-line";

export const ISSUE_WINDOW_DAYS = 180;

/**
 * Stock risk from the newest stock snapshot of owned stock and customer issues in the 180 days before it.
 * Issue quantities are taken as absolute values, so the result does not depend on whether the ERP writes issues as
 * negative or positive; returns are taken off.
 */
export async function companyStockRisk(companyId: string, line: Line | null = null, productCode: string | null = null) {
  const db = getDb();
  const latest = await db.execute(sql`select max(snapshot_date)::text as d from stock_snapshots where company_id = ${companyId}`);
  const asOf = (latest.rows[0] as { d: string | null } | undefined)?.d;
  if (!asOf) return null;

  const snap = await db.execute(sql`
    select p.code, p.name, p.line::text as line, s.batch, s.quantity::text as quantity, s.unit_cost::text as unit_cost, s.expiry_date::text as expiry_date
    from stock_snapshots s join products p on p.company_id = s.company_id and p.id = s.product_id
    where s.company_id = ${companyId} and s.snapshot_date = ${asOf}::date and s.owned and (${line}::text is null or p.line::text = ${line}::text)
      and (${productCode}::text is null or p.code = ${productCode}::text)
  `);
  const batches: StockBatch[] = (snap.rows as Record<string, string | null>[]).map((x) => ({
    productCode: String(x.code),
    productName: String(x.name),
    line: String(x.line),
    batch: String(x.batch ?? ""),
    quantity: Number(x.quantity),
    unitCost: x.unit_cost === null ? null : Number(x.unit_cost),
    expiryDate: x.expiry_date,
  }));

  const tx = await db.execute(sql`
    select p.code,
      (coalesce(sum(abs(t.quantity)) filter (where t.tx_type = 'customer_issue'), 0)
        - coalesce(sum(abs(t.quantity)) filter (where t.tx_type = 'customer_return'), 0))::text as net_issued
    from stock_transactions t join products p on p.company_id = t.company_id and p.id = t.product_id
    where t.company_id = ${companyId} and t.tx_date > (${asOf}::date - ${ISSUE_WINDOW_DAYS}::int) and t.tx_date <= ${asOf}::date
      and (${line}::text is null or p.line::text = ${line}::text)
      and (${productCode}::text is null or p.code = ${productCode}::text)
    group by p.code
  `);
  const daily = new Map((tx.rows as Record<string, string>[]).map((x) => [String(x.code), Math.max(0, Number(x.net_issued)) / ISSUE_WINDOW_DAYS]));

  const hist = await db.execute(sql`select (${asOf}::date - min(tx_date))::int as days from stock_transactions where company_id = ${companyId} and tx_date <= ${asOf}::date`);
  const historyDays = (hist.rows[0] as { days: number | null } | undefined)?.days ?? null;

  return { asOf, historyDays, windowDays: ISSUE_WINDOW_DAYS, batches, dailyIssues: daily, ...buildStockRisk(batches, daily, asOf) };
}
