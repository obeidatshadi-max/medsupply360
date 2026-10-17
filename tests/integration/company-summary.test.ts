/**
 * The Overview's "what has been loaded" counts, against a real Postgres engine (PGlite) with the real migrations:
 * correct per company, newest snapshot only, empty company reads as zeros and no snapshots.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { runImport, type Db } from "@/db/import-writer";

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db/client", () => ({ getDb: () => h.db }));

let client: PGlite;
let a: string;
let empty: string;
const TODAY = "2026-10-09";
const q = async <T>(sql: string) => (await client.query<T>(sql)).rows;

beforeAll(async () => {
  client = new PGlite();
  h.db = drizzle(client, { schema });
  const dir = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(dir + f, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) await client.exec(stmt);
  }
  a = (await q<{ id: string }>(`insert into companies (slug, name) values ('a', 'A') returning id`))[0]!.id;
  empty = (await q<{ id: string }>(`insert into companies (slug, name) values ('e', 'E') returning id`))[0]!.id;
  const imp = (kind: Parameters<typeof runImport>[1]["kind"], text: string, snapshotDate?: string) =>
    runImport(h.db as Db, { companyId: a, userId: null, kind, fileName: `${kind}.csv`, text, today: TODAY, snapshotDate, dryRun: false });
  const csv = (...lines: string[]) => lines.join("\n");
  await imp("products", csv("code,name,category", "P1,Gloves,Consumables", "P2,Analyzer,Equipment"));
  await imp("customers", csv("code,name", "C1,Clinic"));
  await imp("sales", csv("invoice no,line no,date,customer code,product code,qty,net sales", "I1,1,2026-09-01,C1,P1,1,10", "I1,2,2026-09-01,C1,P2,1,20"));
  await imp("open_invoices", csv("invoice no,customer code,invoice date,remaining", "I1,C1,2026-09-01,30"), "2026-10-01");
  await imp("open_invoices", csv("invoice no,customer code,invoice date,remaining", "I1,C1,2026-09-01,25"), "2026-10-08");
}, 60_000);
afterAll(async () => client.close());

describe("companyDataSummary", () => {
  it("counts what was loaded and reports only the newest snapshot", async () => {
    const { companyDataSummary } = await import("@/lib/company-data-summary");
    expect(await companyDataSummary(a)).toEqual({
      products: 2,
      customers: 1,
      invoices: 1,
      salesLines: 2,
      receipts: 0,
      stockTransactions: 0,
      installedUnits: 0,
      openInvoices: { asOf: "2026-10-08", rows: 1 },
      stock: null,
    });
  });

  it("ages the newest unpaid-invoice snapshot, leaving invoices without a due date unaged", async () => {
    const { companyReceivables } = await import("@/lib/receivables");
    const r = await companyReceivables(a);
    expect(r).toMatchObject({ asOf: "2026-10-08", total: 25, overdue: 0, sourceRows: 1 });
    expect(r!.dueDateMissing).toEqual({ invoices: 1, amount: 25 });
    expect(await companyReceivables(empty)).toBeNull();
  });

  it("sums year-to-date sales by line and leaves margin unknown when cost is missing", async () => {
    const { companySalesByLine } = await import("@/lib/sales-by-line");
    const r = await companySalesByLine(a, TODAY);
    const by = (l: string) => r.lines.find((x) => x.line === l)!;
    expect(by("Equipment")).toMatchObject({ sales: 20, priorSales: 0, margin: "Data missing", growth: "Data missing", linesWithoutCost: 1 });
    expect(by("Consumables").sales).toBe(10);
    expect(r.total).toMatchObject({ sales: 30, linesWithoutCost: 2, costCoverage: 0 });
    expect(r).toMatchObject({ from: "2026-01-01", priorTo: "2025-10-09" });
  });

  it("sums cash collected, counting unlinked cash once and showing it apart", async () => {
    const { companyCash } = await import("@/lib/cash");
    await client.exec(`insert into receipts (company_id, receipt_no, allocation_row_id, receipt_date, customer_id, invoice_id, allocated_amount)
      select '${a}', 'R1', '1', '2026-10-05', c.id, i.id, 40 from customers c, invoices i where c.company_id = '${a}' and i.company_id = '${a}' limit 1`);
    await client.exec(`insert into receipts (company_id, receipt_no, allocation_row_id, receipt_date, customer_id, invoice_id, allocated_amount)
      select '${a}', 'R2', '1', '2026-02-10', c.id, null, 10 from customers c where c.company_id = '${a}' limit 1`);
    const r = await companyCash(a, TODAY);
    expect(r).toMatchObject({ ytd: 50, priorYtd: 0, last30: 40, unlinkedYtd: 10, growth: "Data missing" });
    expect(r!.months.find((m) => m.month === "2026-02")!.amount).toBe(10);
    expect(await companyCash(empty, TODAY)).toBeNull();
  });

  it("works out stock risk from owned stock and recent issues, whatever the sign of the issue quantity", async () => {
    const { companyStockRisk } = await import("@/lib/stock-risk");
    const pid = async (code: string) => (await q<{ id: string }>(`select id from products where company_id = '${a}' and code = '${code}'`))[0]!.id;
    const p1 = await pid("P1");
    const p2 = await pid("P2");
    await client.exec(`insert into stock_snapshots (company_id, snapshot_date, product_id, warehouse, batch, quantity, unit_cost, expiry_date, owned) values
      ('${a}', '2026-10-08', '${p1}', 'W', 'B1', 10, 2, '2026-10-18', true),
      ('${a}', '2026-10-08', '${p2}', 'W', '', 5, null, null, true),
      ('${a}', '2026-10-08', '${p2}', 'W', 'X', 99, 1, null, false)`);
    await client.exec(`insert into stock_transactions (company_id, transaction_id, tx_date, product_id, batch, warehouse, tx_type, quantity) values
      ('${a}', 'T1', '2026-09-20', '${p1}', 'B1', 'W', 'customer_issue', -30)`);
    const r = await companyStockRisk(a);
    expect(r).toMatchObject({ asOf: "2026-10-08", stockValue: 20, rows: 2, rowsWithoutCost: 1, historyDays: 18 });
    expect(r!.expiryRisks[0]).toMatchObject({ batch: "B1", unsold: 9, estimatedLoss: 18 });
    expect(await companyStockRisk(empty)).toBeNull();
  });

  it("finds opportunities without guessing from too little history", async () => {
    const { companyOpportunities } = await import("@/lib/opportunities");
    const r = await companyOpportunities(a, TODAY);
    expect(r).toMatchObject({ customersWithEnoughHistory: 0, customersWithoutEnoughHistory: 1, ranked: [], receivablesAsOf: "2026-10-08" });
    expect(await companyOpportunities(empty, TODAY)).toBeNull();
  });

  it("summarises the last 7 days against the 7 before", async () => {
    const { companyWeekly } = await import("@/lib/weekly");
    const r = await companyWeekly(a, TODAY);
    expect(r.windows).toMatchObject({ thisFrom: "2026-10-03", prevTo: "2026-10-02" });
    expect(r.cash).toMatchObject({ now: 40, before: 0, pct: "Data missing" });
    expect(r.sales.now).toBe(0);
    expect(r.overdue).toMatchObject({ nowAsOf: "2026-10-08", beforeAsOf: "2026-10-01" });
    expect(r.importsThisWeek.length).toBeGreaterThan(0);
    const e = await companyWeekly(empty, TODAY);
    expect(e.overdue).toBeNull();
    expect(e.importsThisWeek).toEqual([]);
  });

  it("keeps product reorder histories company-scoped and does not let another product hide a missed order", async () => {
    const { companyProductReorders } = await import("@/lib/product-reorders");
    const company = (await q<{ id: string }>(`insert into companies (slug, name) values ('product-pilot', 'Pilot') returning id`))[0]!.id;
    const imp = (kind: Parameters<typeof runImport>[1]["kind"], text: string) =>
      runImport(h.db as Db, { companyId: company, userId: null, kind, fileName: `${kind}.csv`, text, today: TODAY, dryRun: false });
    await imp("products", "code,name,category,unit\nP1,Reagent,Consumables,pack\nP2,Tubes,Consumables,box\nP3,Analyzer,Equipment,unit");
    await imp("customers", "code,name,segment\nC1,Private clinic,Private\nC2,Public hospital,Tender");
    const dates = ["2026-04-01", "2026-05-01", "2026-05-31", "2026-06-30"];
    const lines = dates.flatMap((date, i) => [
      `I${i},1,${date},C1,P1,10,100`, `I${i},2,${date},C1,P3,1,500`,
      `T${i},1,${date},C2,P1,10,100`,
    ]);
    await imp("sales", ["invoice no,line no,date,customer code,product code,qty,net sales", ...lines,
      "RECENT,1,2026-10-08,C1,P2,20,50", "RETURN,1,2026-10-08,C1,P1,-1,-10",
    ].join("\n"));
    const r = await companyProductReorders(company, TODAY);
    expect(r).toMatchObject({ eligiblePairs: 1, insufficientHistory: 1, partialImport: false });
    expect(r.items[0]).toMatchObject({ customerCode: "C1", productCode: "P1", unit: "pack", typicalQuantity: 10,
      forecast: { lastOrder: "2026-06-30", expectedNext: "2026-07-30", level: "Lapsed" } });
    expect(r.latestImport).not.toBeNull();
    expect(await companyProductReorders(empty, TODAY)).toMatchObject({ eligiblePairs: 0, items: [], latestImport: null });
  });

  it("groups sales by therapeutic area, keeping products with no area apart", async () => {
    const { companyPortfolio } = await import("@/lib/portfolio");
    await client.exec(`update products set therapeutic_area = 'Respiratory' where company_id = '${a}' and code = 'P1'`);
    const r = await companyPortfolio(a, TODAY);
    expect(r!.totalSales).toBe(30);
    const by = (n: string) => r!.areas.find((x) => x.area === n)!;
    expect(by("Respiratory")).toMatchObject({ sales: 10, growth: "Data missing", signal: "No sales last year" });
    expect(by("Area not set").sales).toBe(20);
    expect(r!.unclassifiedShare).toBeCloseTo(20 / 30);
    expect(by("Respiratory").bySegment[0]!.segment).toBe("Not classified");
    expect(await companyPortfolio(empty, TODAY)).toBeNull();
  });

  it("reads an empty company as zeros with no snapshots", async () => {
    const { companyDataSummary } = await import("@/lib/company-data-summary");
    expect(await companyDataSummary(empty)).toMatchObject({ products: 0, invoices: 0, openInvoices: null, stock: null });
  });
});
