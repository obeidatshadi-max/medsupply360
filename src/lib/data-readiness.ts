import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { SPECS, type ImportKind } from "@/core/import/specs";
import { isIsoDate } from "@/core/calc";
import { CHANNEL_INFO } from "@/core/channels";

/** The file types the predictions read: the ERP exports and the installed equipment list. Tender lists and the sales force do not feed them. */
const PREDICTION_SOURCES: ImportKind[] = [...CHANNEL_INFO.erp.kinds, "installed_units"];

interface Batch {
  kind: ImportKind;
  status: string;
  loaded_on: string;
  snapshot_date: string | null;
  rows_accepted: number;
  rows_rejected: number;
}

/** Import presence and coverage indicators only: none establishes accountant reconciliation or model accuracy. */
export async function companyDataReadiness(companyId: string, today: string) {
  if (!isIsoDate(today)) throw new RangeError("Invalid readiness date");
  const db = getDb();
  const [attempts, loaded, coverage] = await Promise.all([
    db.execute(sql`select distinct on (kind) kind, status, (created_at at time zone 'Asia/Amman')::date::text as loaded_on,
      snapshot_date::text, rows_accepted, rows_rejected from import_batches
      where company_id = ${companyId} order by kind, created_at desc, id desc`),
    db.execute(sql`select distinct on (kind) kind, status, (created_at at time zone 'Asia/Amman')::date::text as loaded_on,
      snapshot_date::text, rows_accepted, rows_rejected from import_batches
      where company_id = ${companyId} and rows_accepted > 0 and status in ('accepted', 'partial')
      order by kind, created_at desc, id desc`),
    db.execute(sql`select
      (select min(i.invoice_date)::text from sales_lines s join invoices i on i.company_id = s.company_id and i.id = s.invoice_id
        where s.company_id = ${companyId} and i.invoice_date <= ${today}::date) as first_sale,
      (select max(i.invoice_date)::text from sales_lines s join invoices i on i.company_id = s.company_id and i.id = s.invoice_id
        where s.company_id = ${companyId} and i.invoice_date <= ${today}::date) as last_sale,
      (select count(*)::int from customers where company_id = ${companyId} and segment is null) as unclassified,
      (select count(*)::int from products where company_id = ${companyId} and nullif(trim(unit), '') is null) as missing_units`),
  ]);
  const lastAttempt = new Map((attempts.rows as unknown as Batch[]).map((r) => [r.kind, r]));
  const lastLoaded = new Map((loaded.rows as unknown as Batch[]).map((r) => [r.kind, r]));
  const datasets = PREDICTION_SOURCES.map((kind) => ({ kind, title: SPECS[kind].title,
    latestAttempt: lastAttempt.get(kind) ?? null, lastLoaded: lastLoaded.get(kind) ?? null }));
  const c = coverage.rows[0] as { first_sale: string | null; last_sale: string | null; unclassified: number; missing_units: number };
  return { asOf: today, datasets, firstSale: c.first_sale, lastSale: c.last_sale,
    unclassifiedCustomers: Number(c.unclassified), productsWithoutUnits: Number(c.missing_units),
    missingReorderInputs: (["products", "customers", "sales"] as ImportKind[]).filter((k) => !lastLoaded.has(k)).map((k) => SPECS[k].title),
  };
}
