/**
 * The importer against a real Postgres engine (PGlite) with the project's actual migrations:
 * tenant isolation, idempotent re-imports, snapshot replacement, reference rejection, dry run.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { runImport, type Db, type ImportOutcome, type RunImportInput } from "@/db/import-writer";
import type { ImportKind } from "@/core/import/specs";

let client: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
let a: string;
let b: string;

const TODAY = "2026-10-09";
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await client.query<T>(sql, params)).rows;
const imp = (company: string, kind: ImportKind, text: string, extra: Partial<RunImportInput> = {}): Promise<ImportOutcome> =>
  runImport(db as unknown as Db, { companyId: company, userId: null, kind, fileName: `${kind}.csv`, text, today: TODAY, dryRun: false, ...extra });
const count = async (table: string, company: string) => Number((await q<{ n: string }>(`select count(*) n from ${table} where company_id = $1`, [company]))[0]!.n);

const PRODUCTS = "code,name,category,expiry tracked\nP1,Gloves,Consumables,yes\nP2,Analyzer,Equipment,no";
const CUSTOMERS = "code,name,segment,payment terms\nC1,Hospital,Government,90\nC2,Clinic,Private,30";

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client, { schema });
  const dir = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(dir + f, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) await client.exec(stmt);
  }
  a = (await q<{ id: string }>(`insert into companies (slug, name) values ('a', 'A') returning id`))[0]!.id;
  b = (await q<{ id: string }>(`insert into companies (slug, name) values ('b', 'B') returning id`))[0]!.id;
}, 60_000);
afterAll(async () => client.close());

describe("master data", () => {
  it("loads products and customers, and a different file for another company stays separate", async () => {
    const p = await imp(a, "products", PRODUCTS);
    expect(p).toMatchObject({ state: "done", status: "accepted", rowsAccepted: 2, wrote: true });
    await imp(a, "customers", CUSTOMERS);
    await imp(b, "products", PRODUCTS); // same codes, other company: allowed
    expect(await count("products", a)).toBe(2);
    expect(await count("products", b)).toBe(2);
    const [c1] = await q<{ segment: string; payment_terms_days: number }>(`select segment, payment_terms_days from customers where company_id = $1 and code = 'C1'`, [a]);
    expect(c1).toEqual({ segment: "Tender", payment_terms_days: 90 });
  });

  it("refuses the exact same file twice for the same company", async () => {
    const again = await imp(a, "products", PRODUCTS);
    expect(again).toMatchObject({ state: "already_imported", wrote: false });
    expect(again.message).toMatch(/already imported/);
    expect(await count("import_batches", a)).toBe(2);
  });

  it("updates rows by ERP code on a changed file instead of duplicating", async () => {
    await imp(a, "products", "code,name,category\nP1,Gloves (renamed),Consumables");
    expect(await count("products", a)).toBe(2);
    const [row] = await q<{ name: string; tracks_expiry: boolean }>(`select name, tracks_expiry from products where company_id = $1 and code = 'P1'`, [a]);
    expect(row).toEqual({ name: "Gloves (renamed)", tracks_expiry: false });
  });
});

describe("sales, returns and receipts", () => {
  const SALES = [
    "invoice no,line no,date,customer code,product code,qty,net sales,cost",
    "I1,1,2026-09-01,C1,P1,10,100,60",
    "I1,2,2026-09-01,C1,P2,1,500,300",
    "I2,1,2026-09-05,C2,P1,-2,-20,-12",
    "I3,1,2026-09-06,C9,P1,1,10,6", // unknown customer
    "I4,1,2026-09-06,C1,P9,1,10,6", // unknown product
  ].join("\n");

  it("loads good lines, rejects lines that point at unknown codes, and records a partial batch", async () => {
    const r = await imp(a, "sales", SALES);
    expect(r).toMatchObject({ status: "partial", rowsTotal: 5, rowsAccepted: 3, rowsRejected: 2 });
    expect(r.rejections.map((x) => x.reason)).toEqual([
      expect.stringContaining('unknown customer code "C9"'),
      expect.stringContaining('unknown product code "P9"'),
    ]);
    expect(r.summary).toContainEqual({ label: "Net sales, returns", value: "-20.000 JOD" });
    expect(r.summary).toContainEqual({ label: "Net sales after returns", value: "580.000 JOD" });
    expect(await count("sales_lines", a)).toBe(3);
    expect(await count("invoices", a)).toBe(2);
    const [net] = await q<{ n: string }>(`select sum(net_sales) n from sales_lines where company_id = $1`, [a]);
    expect(Number(net!.n)).toBe(580);
    const [batch] = await q<{ rows_accepted: number; rejections: { row: number }[] }>(
      `select rows_accepted, rejections from import_batches where company_id = $1 and kind = 'sales'`,
      [a],
    );
    expect(batch!.rows_accepted).toBe(3);
    expect(batch!.rejections.map((x) => x.row)).toEqual([5, 6]);
  });

  it("is idempotent when a corrected file re-sends the same lines", async () => {
    await imp(a, "sales", SALES.replace("I1,1,2026-09-01,C1,P1,10,100,60", "I1,1,2026-09-01,C1,P1,10,110,60"));
    expect(await count("sales_lines", a)).toBe(3);
    const [net] = await q<{ n: string }>(`select sum(net_sales) n from sales_lines where company_id = $1`, [a]);
    expect(Number(net!.n)).toBe(590);
  });

  it("stores a due date from the sales file, and a later unpaid-invoice file without one does not erase it", async () => {
    // Own company, so the extra snapshot date and batch do not disturb the counts the other tests check.
    const c = (await q<{ id: string }>(`insert into companies (slug, name) values ('c', 'C') returning id`))[0]!.id;
    const csv = (...lines: string[]) => lines.join("\n");
    await imp(c, "products", csv("code,name,category", "P1,Gloves,Consumables"));
    await imp(c, "customers", csv("code,name", "C1,Clinic"));
    const r = await imp(c, "sales", csv("invoice no,line no,date,customer code,product code,qty,net sales,due date", "I-DUE,1,2026-09-10,C1,P1,1,10,2026-12-09"));
    expect(r.summary).toContainEqual({ label: "Invoices without a due date", value: "0" });
    await imp(c, "open_invoices", csv("invoice no,customer code,invoice date,remaining", "I-DUE,C1,2026-09-10,10"), { snapshotDate: "2026-10-03" });
    const [inv] = await q<{ due_date: string }>(`select due_date::text from invoices where company_id = $1 and invoice_no = 'I-DUE'`, [c]);
    expect(inv!.due_date).toBe("2026-12-09");
  });

  it("stores a therapeutic area, keeps it when a later file has no such column, and replaces it when a file gives a new one", async () => {
    const d = (await q<{ id: string }>(`insert into companies (slug, name) values ('d', 'D') returning id`))[0]!.id;
    const area = async () => (await q<{ therapeutic_area: string | null }>(`select therapeutic_area from products where company_id = $1 and code = 'P1'`, [d]))[0]!.therapeutic_area;
    const csv = (...lines: string[]) => lines.join("\n");
    await imp(d, "products", csv("code,name,category,therapeutic area", "P1,Circuit,Consumables,Respiratory"));
    expect(await area()).toBe("Respiratory");
    await imp(d, "products", csv("code,name,category", "P1,Circuit (renamed),Consumables"));
    expect(await area()).toBe("Respiratory");
    await imp(d, "products", csv("code,name,category,therapeutic area", "P1,Circuit (renamed),Consumables,Critical care"));
    expect(await area()).toBe("Critical care");
  });

  it("does not let company B see or reuse company A's customers", async () => {
    const r = await imp(b, "sales", "invoice no,line no,date,customer code,product code,qty,net sales\nI1,1,2026-09-01,C1,P1,1,10");
    expect(r).toMatchObject({ status: "rejected", rowsAccepted: 0 });
    expect(r.rejections[0]!.reason).toMatch(/unknown customer code "C1"/);
    expect(await count("sales_lines", b)).toBe(0);
  });

  it("keeps cash once, links it to known invoices, and keeps unknown-invoice cash as not linked with a warning", async () => {
    const r = await imp(
      a,
      "receipts",
      [
        "receipt no,allocation row id,date,customer code,invoice no,allocated,receipt total",
        "R1,1,2026-09-10,C1,I1,300,500",
        "R1,2,2026-09-10,C1,,200,500",
        "R2,1,2026-09-11,C2,I-OLD,50,50",
      ].join("\n"),
    );
    expect(r).toMatchObject({ status: "accepted", rowsAccepted: 3 });
    expect(r.warnings).toEqual([{ row: 4, reason: expect.stringContaining("I-OLD is not in the imported invoices") }]);
    const [t] = await q<{ total: string; unlinked: string }>(
      `select sum(allocated_amount) total, sum(allocated_amount) filter (where invoice_id is null) unlinked from receipts where company_id = $1`,
      [a],
    );
    expect(Number(t!.total)).toBe(550);
    expect(Number(t!.unlinked)).toBe(250);
    expect(r.summary).toContainEqual({ label: "Cash received", value: "550.000 JOD" });
  });
});

describe("snapshots", () => {
  it.each(["open_invoices", "stock_snapshot"] as const)("preserves %s and invoice headers when any replacement row fails", async (kind) => {
    const company = (await q<{ id: string }>(`insert into companies (slug, name) values ($1, 'Snapshot safety') returning id`, [`safe-${kind}`]))[0]!.id;
    await imp(company, "products", PRODUCTS);
    await imp(company, "customers", CUSTOMERS);
    const snapshotDate = "2026-10-08";
    const header = kind === "open_invoices" ? "invoice no,customer code,invoice date,due date,remaining" : "product code,warehouse,batch,qty,unit cost";
    const original = kind === "open_invoices" ? "SAFE,C1,2026-09-01,2026-09-30,100" : "P1,Main,B1,10,2.5";
    const changed = kind === "open_invoices" ? "SAFE,C1,2026-09-01,2026-12-31,5" : "P1,Main,B1,1,2.5";
    const invalid = kind === "open_invoices" ? "NEW,C9,2026-09-01,2026-09-30,25" : "P9,Main,B2,5,2.5";
    const table = kind === "open_invoices" ? "open_invoice_snapshots" : "stock_snapshots";
    await imp(company, kind, `${header}\n${original}`, { snapshotDate });
    const before = await q(`select * from ${table} where company_id = $1`, [company]);
    const headersBefore = await q(`select * from invoices where company_id = $1`, [company]);
    for (const dryRun of [true, false]) {
      const r = await imp(company, kind, `${header}\n${changed}\n${invalid}`, { snapshotDate, dryRun });
      expect(r).toMatchObject({ status: "rejected", rowsAccepted: 0, rowsRejected: 2, wrote: false, summary: [] });
      expect(r.message).toContain("Snapshot blocked");
      expect(r.rejections).toContainEqual({ row: 3, reason: expect.stringContaining("unknown") });
      expect(await q(`select * from ${table} where company_id = $1`, [company])).toEqual(before);
      expect(await q(`select * from invoices where company_id = $1`, [company])).toEqual(headersBefore);
    }
    // Parser errors must be atomic as well as database reference errors.
    const parserFailure = await imp(company, kind, `${header}\n${changed}\nbad`, { snapshotDate });
    expect(parserFailure).toMatchObject({ status: "rejected", wrote: false, rowsAccepted: 0 });
    expect(await q(`select * from ${table} where company_id = $1`, [company])).toEqual(before);
    const batches = await q<{ status: string; rows_accepted: number }>(`select status, rows_accepted from import_batches where company_id = $1 and status = 'rejected'`, [company]);
    expect(batches).toHaveLength(2);
    expect(batches.every((x) => x.rows_accepted === 0)).toBe(true);
    // A clean replacement still succeeds.
    expect(await imp(company, kind, `${header}\n${changed}`, { snapshotDate })).toMatchObject({ status: "accepted", wrote: true });
  });

  const OPEN = "invoice no,customer code,invoice date,due date,remaining\nI1,C1,2026-09-01,2026-09-30,110\nI2,C2,2026-09-05,,-20";

  it("replaces a snapshot date on re-upload and keeps other dates", async () => {
    await imp(a, "open_invoices", OPEN, { snapshotDate: "2026-10-01" });
    await imp(a, "open_invoices", OPEN.replace("110", "100"), { snapshotDate: "2026-10-01" });
    await imp(a, "open_invoices", OPEN.replace("110", "90"), { snapshotDate: "2026-10-08" });
    const rows = await q<{ snapshot_date: string; n: string; total: string }>(
      `select snapshot_date::text, count(*) n, sum(remaining_amount) total from open_invoice_snapshots where company_id = $1 group by 1 order by 1`,
      [a],
    );
    expect(rows).toEqual([
      { snapshot_date: "2026-10-01", n: 2, total: "80.000" },
      { snapshot_date: "2026-10-08", n: 2, total: "70.000" },
    ]);
  });

  it("states unknown ages instead of folding them into the aging buckets", async () => {
    const r = await imp(a, "open_invoices", OPEN.replace("110", "95"), { snapshotDate: "2026-10-08" });
    expect(r.summary).toContainEqual({ label: "1-30 days overdue", value: "95.000 JOD" });
    expect(r.summary).toContainEqual({ label: "No due date (age unknown)", value: "1 invoices, -20.000 JOD" });
  });

  it("keeps a due date supplied earlier when a later file has none", async () => {
    await imp(a, "open_invoices", "invoice no,customer code,invoice date,remaining\nI1,C1,2026-09-01,60", { snapshotDate: "2026-10-09" });
    const [inv] = await q<{ due_date: string }>(`select due_date::text from invoices where company_id = $1 and invoice_no = 'I1'`, [a]);
    expect(inv!.due_date).toBe("2026-09-30");
  });

  it("loads stock by batch with ownership and replaces its date", async () => {
    const STOCK = "product code,warehouse,batch,qty,unit cost,expiry,ownership\nP1,Main,B1,10,2.5,2026-09-01,Owned\nP1,Main,B2,4,,,Consignment";
    const r = await imp(a, "stock_snapshot", STOCK, { snapshotDate: "2026-10-08" });
    expect(r.summary).toContainEqual({ label: "Owned stock value (cost known)", value: "25.000 JOD" });
    expect(r.summary).toContainEqual({ label: "Rows past expiry at snapshot", value: "1" });
    await imp(a, "stock_snapshot", STOCK.replace("10,2.5", "20,2.5"), { snapshotDate: "2026-10-08" });
    expect(await count("stock_snapshots", a)).toBe(2);
  });
});

describe("stock transactions, units and modes", () => {
  it("upserts transactions by transaction id", async () => {
    const T = "transaction id,date,product code,warehouse,type,qty\nT1,2026-09-01,P1,Main,Issue,-5\nT2,2026-09-02,P1,Main,Transfer,-1";
    await imp(a, "stock_transactions", T);
    await imp(a, "stock_transactions", T.replace("-5", "-6"));
    expect(await count("stock_transactions", a)).toBe(2);
    const [t] = await q<{ quantity: string; tx_type: string }>(`select quantity, tx_type from stock_transactions where company_id = $1 and transaction_id = 'T1'`, [a]);
    expect(t).toEqual({ quantity: "-6.000", tx_type: "customer_issue" });
  });

  it("loads installed units and rejects an unknown product", async () => {
    const r = await imp(a, "installed_units", "unit code,customer code,product code,name,installed on\nU1,C1,P2,Analyzer,2025-01-01\nU2,C1,P9,Mystery,2025-01-01");
    expect(r).toMatchObject({ status: "partial", rowsAccepted: 1 });
    expect(await count("installed_units", a)).toBe(1);
  });

  it("dry run checks everything and writes nothing, not even the batch record", async () => {
    const before = await count("import_batches", a);
    const r = await imp(a, "customers", "code,name\nC7,New clinic", { dryRun: true });
    expect(r).toMatchObject({ state: "done", dryRun: true, wrote: false, rowsAccepted: 1, batchId: null });
    expect(r.summary[0]).toEqual({ label: "Customers loaded", value: "1" });
    expect(await count("customers", a)).toBe(2);
    expect(await count("import_batches", a)).toBe(before);
  });

  it("returns a fatal outcome for an unreadable file and writes nothing", async () => {
    const before = await count("import_batches", a);
    const r = await imp(a, "products", "foo,bar\n1,2");
    expect(r).toMatchObject({ state: "fatal", wrote: false });
    expect(r.message).toMatch(/Required columns? not found/);
    expect(await count("import_batches", a)).toBe(before);
  });

  it("lets a fully rejected file be recorded again once the data it needs exists", async () => {
    const FILE = "invoice no,line no,date,customer code,product code,qty,net sales\nIX,1,2026-09-01,C77,P1,1,10";
    expect(await imp(a, "sales", FILE)).toMatchObject({ status: "rejected" });
    await imp(a, "customers", "code,name\nC77,Late arrival");
    const retry = await imp(a, "sales", FILE);
    expect(retry).toMatchObject({ status: "accepted", rowsAccepted: 1 });
    const batches = await q(`select 1 from import_batches where company_id = $1 and kind = 'sales' and rows_total = 1`, [a]);
    expect(batches).toHaveLength(1);
  });
});
