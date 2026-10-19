import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as schema from "@/db/schema";
import { runImport, type Db } from "@/db/import-writer";
import { CompanyAccounts } from "@/components/company-accounts";
import { DataReadiness } from "@/components/data-readiness";

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db/client", () => ({ getDb: () => h.db }));
let client: PGlite;
let a: string, b: string, mastersOnly: string, empty: string, partial: string;
const TODAY = "2026-10-17";
const q = async <T>(sql: string, args: unknown[] = []) => (await client.query<T>(sql, args)).rows;
const imp = (companyId: string, kind: Parameters<typeof runImport>[1]["kind"], text: string, snapshotDate?: string) =>
  runImport(h.db as Db, { companyId, userId: null, kind, fileName: `${kind}.csv`, text, today: TODAY, dryRun: false, snapshotDate });

beforeAll(async () => {
  client = new PGlite(); h.db = drizzle(client, { schema });
  const dir = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(dir + f, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) await client.exec(stmt);
  }
  const create = async (slug: string) => (await q<{ id: string }>("insert into companies (slug, name) values ($1, $1) returning id", [slug]))[0]!.id;
  a = await create("accounts-a"); b = await create("accounts-b"); mastersOnly = await create("masters"); empty = await create("empty");
  await imp(a, "products", "code,name,category,unit\nP1,Reagent,Consumables,pack\nP2,Analyzer,Equipment,");
  await imp(a, "customers", "code,name,segment,city,account owner\nC1,Clinic,Private,Amman,Owner A\nC2,Hospital,Tender,Irbid,Owner B\nC3,Unknown,,Amman,");
  await imp(a, "sales", ["invoice no,line no,date,customer code,product code,qty,net sales,cost",
    "I1,1,2026-09-01,C1,P1,10,100,60", "I1,2,2026-09-01,C1,P2,1,50,30",
    "R1,1,2026-09-20,C1,P1,-2,-20,-12", "I2,1,2026-09-02,C2,P1,20,200,",
    "OLD,1,2025-12-01,C1,P1,2,20,12"].join("\n"));
  await imp(a, "open_invoices", "invoice no,customer code,invoice date,due date,remaining\nI1,C1,2026-09-01,2026-09-30,999", "2026-09-25");
  await imp(a, "open_invoices", ["invoice no,customer code,invoice date,due date,remaining", "I1,C1,2026-09-01,2026-09-30,80",
    "I2,C2,2026-09-02,,100", "CR1,C1,2026-08-01,,-5"].join("\n"), "2026-10-08");
  await imp(a, "stock_snapshot", "product code,warehouse,batch,qty,unit cost\nP1,Main,B1,10,5", "2026-10-08");
  await imp(a, "stock_snapshot", "product code,warehouse,batch,qty,unit cost\nP1,Main,B1,1,5\nP9,Main,B2,1,5", "2026-10-08");
  await q("update import_batches set created_at = case when status = 'rejected' then '2026-10-17T09:00:00Z'::timestamptz else '2026-10-16T09:00:00Z'::timestamptz end where company_id = $1 and kind = 'stock_snapshot'", [a]);
  await imp(b, "products", "code,name,category,unit\nP1,Other reagent,Consumables,pack");
  await imp(b, "customers", "code,name,segment\nC1,Other clinic,Private");
  await imp(b, "sales", "invoice no,line no,date,customer code,product code,qty,net sales,cost\nI1,1,2026-09-01,C1,P1,10,900,500");
  await imp(mastersOnly, "customers", "code,name\nC0,No history");
  partial = await create("partial");
  await imp(partial, "products", "code,name,category,unit\nP1,Reagent,Consumables,pack");
  await imp(partial, "customers", "code,name,segment\nC1,Half costed,Private");
  await imp(partial, "sales", ["invoice no,line no,date,customer code,product code,qty,net sales,cost", "I1,1,2026-09-01,C1,P1,10,100,60", "I1,2,2026-09-01,C1,P1,5,50,"].join("\n"));
}, 60_000);
afterAll(async () => client.close());

describe("imported company accounts", () => {
  it("sums sales and returns once, keeps only the latest balance snapshot, and does not join-multiply amounts", async () => {
    const { companyAccounts } = await import("@/lib/company-accounts");
    const r = await companyAccounts(a, TODAY);
    // C2's only line has no cost, so it adds sales but no profit; the coverage says 130 of 330 is costed.
    expect(r).toMatchObject({ matchedCount: 3, snapshotDate: "2026-10-08", summary: { sales: 330, grossProfit: 52, outstanding: 175, overdue: 80 } });
    expect(r.summary.costCoverage).toBeCloseTo(130 / 330, 6);
    expect(r.rows.find((r) => r.code === "C1")).toMatchObject({ sales: 130, grossProfit: 52, outstanding: 75, overdue: 80, lastOrder: "2026-09-01", unagedInvoices: 0 });
    expect(r.rows.find((r) => r.code === "C2")).toMatchObject({ grossProfit: null, linesWithoutCost: 1, unagedInvoices: 1, overdue: 0 });
  });
  it("counts profit on the costed lines of a partly costed account and reports how much of its sales that covers", async () => {
    const { companyAccounts } = await import("@/lib/company-accounts");
    const r = await companyAccounts(partial, TODAY);
    expect(r.rows[0]).toMatchObject({ sales: 150, costedSales: 100, grossProfit: 40, linesWithoutCost: 1 });
    expect(r.summary).toMatchObject({ sales: 150, grossProfit: 40 });
    expect(r.summary.costCoverage).toBeCloseTo(100 / 150, 6);
    const html = renderToStaticMarkup(createElement(CompanyAccounts, { report: r, view: "all" }));
    expect(html).toContain("Product cost known for 67% of sales");
    expect(html).toContain("1 sales lines missing cost");
  });
  it("shows no profit and no coverage when nothing is costed or no sales file exists", async () => {
    const { companyAccounts } = await import("@/lib/company-accounts");
    expect((await companyAccounts(a, TODAY, "tender")).summary).toMatchObject({ sales: 200, grossProfit: null, costCoverage: null });
    expect((await companyAccounts(mastersOnly, TODAY)).summary).toMatchObject({ sales: null, grossProfit: null, costCoverage: null });
  });
  it("filters segment and search, scopes totals to matches, and isolates identical codes in different companies", async () => {
    const { companyAccounts } = await import("@/lib/company-accounts");
    expect(await companyAccounts(a, TODAY, "private", "owner a")).toMatchObject({ matchedCount: 1, summary: { sales: 130, grossProfit: 52 } });
    expect(await companyAccounts(a, TODAY, "tender", "clinic")).toMatchObject({ matchedCount: 0, rows: [] });
    expect((await companyAccounts(b, TODAY)).rows[0]).toMatchObject({ name: "Other clinic", sales: 900, grossProfit: 400, outstanding: null });
    expect((await companyAccounts(a, TODAY, "all", "C3")).rows[0]).toMatchObject({ segment: null, sales: 0, outstanding: 0 });
  });
  it("keeps unavailable files unknown and renders genuine company empty states", async () => {
    const { companyAccounts } = await import("@/lib/company-accounts");
    const report = await companyAccounts(mastersOnly, TODAY);
    expect(report.rows[0]).toMatchObject({ sales: null, grossProfit: null, outstanding: null, overdue: null });
    const html = renderToStaticMarkup(createElement(CompanyAccounts, { report, view: "all" }));
    expect(html).toContain("No history"); expect(html).toContain("Data missing");
    expect(html).toContain("Classify account"); expect(html).not.toContain("Healthy");
    const noCustomers = await companyAccounts(empty, TODAY);
    expect(noCustomers.rows).toEqual([]);
    expect(renderToStaticMarkup(createElement(CompanyAccounts, { report: noCustomers, view: "all" }))).toContain("No company customers are loaded yet");
  });
});

describe("prediction input readiness", () => {
  it("separates a rejected attempt from the last successful load and exposes missing classifications and units", async () => {
    const { companyDataReadiness } = await import("@/lib/data-readiness");
    const report = await companyDataReadiness(a, TODAY);
    expect(report).toMatchObject({ firstSale: "2025-12-01", lastSale: "2026-09-20", unclassifiedCustomers: 1, productsWithoutUnits: 1, missingReorderInputs: [] });
    expect(report.datasets).toHaveLength(8);
    expect(report.datasets.find((d) => d.kind === "stock_snapshot")).toMatchObject({
      lastLoaded: { status: "accepted", loaded_on: "2026-10-16", rows_accepted: 1 },
      latestAttempt: { status: "rejected", loaded_on: "2026-10-17", rows_accepted: 0 },
    });
    const html = renderToStaticMarkup(createElement(DataReadiness, { report }));
    expect(html).toContain("Rejected on 2026-10-17; prior data retained");
    expect(html).toContain("not confirmed completeness or forecast accuracy");
  });
  it("shows all missing sources for an empty company without leaking another company's history", async () => {
    const { companyDataReadiness } = await import("@/lib/data-readiness");
    const r = await companyDataReadiness(empty, TODAY);
    expect(r).toMatchObject({ firstSale: null, lastSale: null, unclassifiedCustomers: 0, productsWithoutUnits: 0 });
    expect(r.missingReorderInputs).toHaveLength(3);
    expect(r.datasets.every((d) => d.lastLoaded === null && d.latestAttempt === null)).toBe(true);
  });
  it("does not imply a first rejected import loaded or retained a snapshot", async () => {
    await imp(mastersOnly, "stock_snapshot", "product code,warehouse,batch,qty,unit cost\nUNKNOWN,Main,B1,1,5", "2026-10-08");
    const { companyDataReadiness } = await import("@/lib/data-readiness");
    const report = await companyDataReadiness(mastersOnly, TODAY);
    expect(report.datasets.find((d) => d.kind === "stock_snapshot")).toMatchObject({ lastLoaded: null, latestAttempt: { status: "rejected", rows_accepted: 0 } });
    const html = renderToStaticMarkup(createElement(DataReadiness, { report }));
    expect(html).toContain("nothing loaded");
    expect(html).not.toContain("prior data retained");
  });
});
