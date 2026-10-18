import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";

export interface CompanyDataSummary {
  products: number;
  customers: number;
  invoices: number;
  salesLines: number;
  receipts: number;
  stockTransactions: number;
  installedUnits: number;
  /** Latest snapshot date of each point-in-time file, and how many rows that snapshot holds. */
  openInvoices: { asOf: string; rows: number } | null;
  stock: { asOf: string; rows: number } | null;
  /** Date of the newest invoice and receipt; used to tell how fresh the transaction files are. */
  latestInvoice: string | null;
  latestReceipt: string | null;
}

/** What has been loaded for one company, straight from the database. Counts only; no figure is calculated here. */
export async function companyDataSummary(companyId: string): Promise<CompanyDataSummary> {
  const r = await getDb().execute(sql`
    select
      (select count(*)::int from products where company_id = ${companyId}) as products,
      (select count(*)::int from customers where company_id = ${companyId}) as customers,
      (select count(*)::int from invoices where company_id = ${companyId}) as invoices,
      (select count(*)::int from sales_lines where company_id = ${companyId}) as sales_lines,
      (select count(*)::int from receipts where company_id = ${companyId}) as receipts,
      (select count(*)::int from stock_transactions where company_id = ${companyId}) as stock_transactions,
      (select count(*)::int from installed_units where company_id = ${companyId}) as installed_units,
      (select max(invoice_date)::text from invoices where company_id = ${companyId}) as latest_invoice,
      (select max(receipt_date)::text from receipts where company_id = ${companyId}) as latest_receipt,
      (select max(snapshot_date)::text from open_invoice_snapshots where company_id = ${companyId}) as open_as_of,
      (select count(*)::int from open_invoice_snapshots where company_id = ${companyId}
         and snapshot_date = (select max(snapshot_date) from open_invoice_snapshots where company_id = ${companyId})) as open_rows,
      (select max(snapshot_date)::text from stock_snapshots where company_id = ${companyId}) as stock_as_of,
      (select count(*)::int from stock_snapshots where company_id = ${companyId}
         and snapshot_date = (select max(snapshot_date) from stock_snapshots where company_id = ${companyId})) as stock_rows
  `);
  const row = r.rows[0] as Record<string, number | string | null>;
  return {
    products: Number(row.products),
    customers: Number(row.customers),
    invoices: Number(row.invoices),
    salesLines: Number(row.sales_lines),
    receipts: Number(row.receipts),
    stockTransactions: Number(row.stock_transactions),
    installedUnits: Number(row.installed_units),
    openInvoices: row.open_as_of ? { asOf: String(row.open_as_of), rows: Number(row.open_rows) } : null,
    stock: row.stock_as_of ? { asOf: String(row.stock_as_of), rows: Number(row.stock_rows) } : null,
    latestInvoice: row.latest_invoice ? String(row.latest_invoice) : null,
    latestReceipt: row.latest_receipt ? String(row.latest_receipt) : null,
  };
}
