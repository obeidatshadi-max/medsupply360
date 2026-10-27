/**
 * The business-line filter against a real Postgres engine (PGlite): stock risk, installed units, portfolio and
 * accounts follow the chosen line, the other lines stay out, and All lines (null) leaves everything in.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { runImport, type Db } from "@/db/import-writer";
import { companyAccounts } from "@/lib/company-accounts";
import { companyInstalledBase, companyInstalledUnits } from "@/lib/installed-base";
import { companyPortfolio } from "@/lib/portfolio";
import { companyStockRisk } from "@/lib/stock-risk";

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db/client", () => ({ getDb: () => h.db }));

let client: PGlite;
let a: string;
const TODAY = "2026-10-20";
const q = async <T>(sql: string, args: unknown[] = []) => (await client.query<T>(sql, args)).rows;
const imp = (kind: Parameters<typeof runImport>[1]["kind"], text: string, snapshotDate?: string) =>
  runImport(h.db as Db, { companyId: a, userId: null, kind, fileName: `${kind}-${Math.random()}.csv`, text, today: TODAY, dryRun: false, snapshotDate });

beforeAll(async () => {
  client = new PGlite();
  h.db = drizzle(client, { schema });
  const dir = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(dir + f, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) await client.exec(stmt);
  }
  a = (await q<{ id: string }>("insert into companies (slug, name) values ('lf', 'LF') returning id"))[0]!.id;
  await imp("products", "code,name,category,unit,therapeutic area\nP1,Reagent,Consumables,pack,Hematology\nP2,Analyzer,Equipment,piece,Chemistry\nP3,Reader,Devices,piece,Chemistry");
  await imp("customers", "code,name,segment\nC1,Hospital A,Tender\nC2,Clinic B,Private");
  await imp(
    "sales",
    ["invoice no,line no,date,customer code,product code,qty,net sales,cost", "I1,1,2026-09-01,C1,P1,10,100,60", "I1,2,2026-09-01,C1,P2,1,5000,3000", "I2,1,2026-09-02,C2,P3,2,800,500"].join("\n"),
  );
  await imp("stock_snapshot", "product code,warehouse,batch,qty,unit cost\nP1,Main,B1,10,5\nP2,Main,B2,2,100", "2026-10-08");
  await imp(
    "installed_units",
    "unit code,customer code,product code,name,expected monthly consumables\nU1,C1,P2,Analyzer,400\nU2,C2,P3,Reader,100\nU3,C2,,Loose unit,50",
  );
}, 60_000);
afterAll(async () => client.close());

describe("line filter on the data screens", () => {
  it("narrows stock risk to the chosen line", async () => {
    const all = await companyStockRisk(a, null);
    const cons = await companyStockRisk(a, "Consumables");
    const equip = await companyStockRisk(a, "Equipment");
    expect(all!.stockValue).toBe(250);
    expect(cons!.stockValue).toBe(50);
    expect(equip!.stockValue).toBe(200);
    expect((await companyStockRisk(a, "Devices"))!.stockValue).toBe(0);
  });

  it("keeps installed machines of the chosen line, and unit with no product only under All lines", async () => {
    // Two readers were sold to C2: one is described by hand (U2); the other is a device, and devices are not taken from the sales.
    expect((await companyInstalledUnits(a, null)).map((u) => u.code).sort()).toEqual(["U1", "U2", "U3"]);
    expect((await companyInstalledUnits(a, "Equipment")).map((u) => u.code)).toEqual(["U1"]);
    expect((await companyInstalledUnits(a, "Devices")).map((u) => u.code).sort()).toEqual(["U2"]);
    expect((await companyInstalledUnits(a, "Consumables")).map((u) => u.code)).toEqual([]);
    const base = await companyInstalledBase(a, TODAY, "Equipment");
    expect(base.totals).toMatchObject({ units: 1, customers: 1 });
  });

  it("narrows the portfolio and the account sales to the chosen line", async () => {
    const all = await companyPortfolio(a, TODAY, null);
    const dev = await companyPortfolio(a, TODAY, "Devices");
    expect(all).not.toBeNull();
    expect(dev).not.toBeNull();
    expect(await companyPortfolio(a, TODAY, "Consumables")).not.toBeNull();
    const accAll = await companyAccounts(a, TODAY, "all", "", TODAY, null);
    const accEq = await companyAccounts(a, TODAY, "all", "", TODAY, "Equipment");
    const sales = (r: typeof accAll, code: string) => r.rows.find((x) => x.code === code)!.sales;
    expect(sales(accAll, "C1")).toBe(5100);
    expect(sales(accEq, "C1")).toBe(5000);
    expect(sales(accEq, "C2")).toBe(0);
  });
});
