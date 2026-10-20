/**
 * The detail screens' data against a real Postgres engine (PGlite): one machine with its customer's purchases and linked
 * consumables, and one product's batches, each company-scoped.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { runImport, type Db } from "@/db/import-writer";
import { companyStockRisk } from "@/lib/stock-risk";
import { companyUnitDetail } from "@/lib/unit-detail";

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db/client", () => ({ getDb: () => h.db }));

let client: PGlite;
let a: string;
let b: string;
const TODAY = "2026-10-20";
const q = async <T>(sql: string, args: unknown[] = []) => (await client.query<T>(sql, args)).rows;
const imp = (company: string, kind: Parameters<typeof runImport>[1]["kind"], text: string, snapshotDate?: string) =>
  runImport(h.db as Db, { companyId: company, userId: null, kind, fileName: `${kind}-${Math.random()}.csv`, text, today: TODAY, dryRun: false, snapshotDate });

beforeAll(async () => {
  client = new PGlite();
  h.db = drizzle(client, { schema });
  const dir = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(dir + f, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) await client.exec(stmt);
  }
  const create = async (slug: string) => (await q<{ id: string }>("insert into companies (slug, name) values ($1, $1) returning id", [slug]))[0]!.id;
  a = await create("dt-a");
  b = await create("dt-b");
  await imp(a, "products", "code,name,category,unit,supplier name\nP1,Reagent pack,Consumables,pack,Sysmex\nP2,Analyzer XN,Equipment,piece,Sysmex\nP3,Control kit,Consumables,box,Roche");
  await imp(a, "customers", "code,name,segment\nC1,Hospital A,Tender\nC2,Clinic B,Private");
  await imp(
    a,
    "sales",
    ["invoice no,line no,date,customer code,product code,qty,net sales,cost", "I1,1,2026-09-01,C1,P1,10,600,300", "I1,2,2026-09-01,C1,P3,2,150,90", "I2,1,2026-10-05,C1,P1,5,300,150", "I3,1,2026-10-06,C1,P2,1,9000,6000"].join("\n"),
  );
  await imp(a, "installed_units", "unit code,customer code,product code,name,installed on,warranty end,service,expected monthly consumables\nU1,C1,P2,Analyzer XN room 1,2020-01-10,2022-01-09,No contract,500\nU2,C1,P2,Analyzer XN room 2,2025-02-01,2027-02-01,Active,300");
  await imp(a, "stock_transactions", "transaction id,date,product code,warehouse,type,qty\nT1,2026-09-01,P1,Main,customer issue,-9");
  await imp(a, "stock_snapshot", "product code,warehouse,batch,qty,unit cost,expiry date\nP1,Main,B1,10,5,2026-12-01\nP1,Main,B2,20,5,2027-06-01\nP3,Main,B9,4,40,2027-01-01", "2026-10-08");
  await imp(b, "products", "code,name,category,unit\nP1,Their reagent,Consumables,pack");
  await imp(b, "stock_snapshot", "product code,warehouse,batch,qty,unit cost\nP1,Main,Z1,99,1", "2026-10-08");
}, 60_000);
afterAll(async () => client.close());

describe("unit detail", () => {
  it("shows the machine, its customer's combined figures, its product and the consumables bought", async () => {
    const d = await companyUnitDetail(a, "U1", TODAY);
    expect(d).not.toBeNull();
    expect(d!.unit.name).toBe("Analyzer XN room 1");
    expect(d!.product).toMatchObject({ code: "P2", name: "Analyzer XN", line: "Equipment", supplier: "Sysmex" });
    expect(d!.account.expectedMonthly).toBe(800);
    expect(d!.account.units).toHaveLength(2);
    expect(d!.otherUnits.map((u) => u.code)).toEqual(["U2"]);
    // Consumables only (the 9000 analyzer sale is excluded), biggest first.
    expect(d!.linked).toEqual([
      { code: "P1", name: "Reagent pack", sales: 900 },
      { code: "P3", name: "Control kit", sales: 150 },
    ]);
  });

  it("returns nothing for an unknown machine or another company's machine", async () => {
    expect(await companyUnitDetail(a, "NOPE", TODAY)).toBeNull();
    expect(await companyUnitDetail(b, "U1", TODAY)).toBeNull();
  });
});

describe("product stock detail", () => {
  it("returns only that product's batches and its recent use", async () => {
    const r = await companyStockRisk(a, null, "P1");
    expect(r!.batches.map((x) => x.batch).sort()).toEqual(["B1", "B2"]);
    expect(r!.batches.every((x) => x.productCode === "P1")).toBe(true);
    expect(r!.dailyIssues.get("P1")).toBeGreaterThan(0);
  });

  it("is empty for a product with no stock, and never shows another company's batch", async () => {
    expect((await companyStockRisk(a, null, "NOPE"))!.batches).toEqual([]);
    expect((await companyStockRisk(b, null, "P1"))!.batches.map((x) => x.batch)).toEqual(["Z1"]);
  });
});
