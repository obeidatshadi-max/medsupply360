/**
 * Machines taken from the imported sales, the customer's own earlier norm as the expectation, and the optional details the
 * owner adds, against a real Postgres engine (PGlite): nothing has to be typed twice.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { runImport, type Db } from "@/db/import-writer";
import { companyInstalledBase, companyInstalledUnits } from "@/lib/installed-base";
import { saveMachineDetails } from "@/server/services/machine-details";

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db/client", () => ({ getDb: () => h.db }));

let client: PGlite;
let a: string;
let b: string;
const TODAY = "2026-10-20";
const q = async <T>(sql: string, args: unknown[] = []) => (await client.query<T>(sql, args)).rows;
const imp = (company: string, kind: Parameters<typeof runImport>[1]["kind"], text: string) =>
  runImport(h.db as Db, { companyId: company, userId: null, kind, fileName: `${kind}-${Math.random()}.csv`, text, today: TODAY, dryRun: false });

beforeAll(async () => {
  client = new PGlite();
  h.db = drizzle(client, { schema });
  const dir = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(dir + f, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) await client.exec(stmt);
  }
  const create = async (slug: string) => (await q<{ id: string }>("insert into companies (slug, name) values ($1, $1) returning id", [slug]))[0]!.id;
  a = await create("dm-a");
  b = await create("dm-b");
  await imp(a, "products", "code,name,category,unit\nP1,Reagent,Consumables,pack\nP2,Analyzer XN,Equipment,piece\nP3,Reader,Devices,piece");
  await imp(a, "customers", "code,name,segment\nC1,Hospital A,Tender\nC2,Clinic B,Private\nC3,Lab C,Private");
  const rows = ["invoice no,line no,date,customer code,product code,qty,net sales,cost"];
  // C1 bought two analyzers (one returned later => one stays) and one reader; steady consumables for 6 months, then little lately.
  rows.push("E1,1,2024-03-01,C1,P2,2,20000,12000", "E2,1,2025-05-01,C1,P3,1,900,600", "RET,1,2025-06-01,C1,P2,-1,-10000,-6000");
  for (const m of ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04"]) rows.push(`C1-${m},1,${m}-10,C1,P1,10,100,60`);
  rows.push("C1-R,1,2026-10-10,C1,P1,3,100,60");
  // C2 bought a reader (a device, so not a machine), one analyzer and consumables in only two earlier months.
  rows.push("E3,1,2026-01-05,C2,P3,1,800,500", "E3b,1,2026-01-05,C2,P2,1,10000,6000", "C2-1,1,2026-01-10,C2,P1,10,500,300", "C2-2,1,2026-02-10,C2,P1,10,500,300", "C2-R,1,2026-10-09,C2,P1,1,20,10");
  await imp(a, "sales", rows.join("\n"));
  await imp(b, "products", "code,name,category,unit\nP2,Their analyzer,Equipment,piece");
  await imp(b, "customers", "code,name,segment\nC1,Their hospital,Tender");
  await imp(b, "sales", ["invoice no,line no,date,customer code,product code,qty,net sales,cost", "B1,1,2026-02-01,C1,P2,5,50000,30000"].join("\n"));
}, 90_000);
afterAll(async () => client.close());

describe("machines from the imported sales", () => {
  it("makes a machine for every piece of equipment sold, net of returns, and ignores consumables and devices", async () => {
    const units = await companyInstalledUnits(a);
    expect(units.map((u) => u.code).sort()).toEqual(["ERP-C1-P2-1", "ERP-C2-P2-1"]);
    const analyzer = units.find((u) => u.code === "ERP-C1-P2-1")!;
    expect(analyzer).toMatchObject({ name: "Analyzer XN", line: "Equipment", source: "erp", installedOn: "2024-03-01", warrantyEnd: null, service: null });
  });

  it("never shows another company's sales", async () => {
    expect((await companyInstalledUnits(b)).map((u) => u.code)).toEqual(["ERP-C1-P2-1", "ERP-C1-P2-2", "ERP-C1-P2-3", "ERP-C1-P2-4", "ERP-C1-P2-5"]);
    expect((await companyInstalledUnits(b)).every((u) => u.customerName === "Their hospital")).toBe(true);
  });
});

describe("the customer's own earlier norm", () => {
  it("expects what a regular customer used to buy, and flags the drop", async () => {
    const base = await companyInstalledBase(a, TODAY);
    const c1 = base.accounts.find((x) => x.customerCode === "C1")!;
    expect(c1.expectedSource).toBe("history");
    // 6 months of 100 over a 9-month span.
    expect(c1.expectedMonthly).toBeCloseTo(600 / 9, 5);
    expect(c1.actualMonthly).toBeCloseTo((100 * 30) / 90, 5);
    expect(c1.gapMonthly).toBeCloseTo(600 / 9 - 100 / 3, 5);
  });

  it("gives no expectation to a customer who did not buy often enough before", async () => {
    const c2 = (await companyInstalledBase(a, TODAY)).accounts.find((x) => x.customerCode === "C2")!;
    expect(c2).toMatchObject({ expectedMonthly: null, expectedSource: null, gapMonthly: null });
  });
});

describe("details the owner adds", () => {
  it("replaces the machine taken from the sales, and an estimate typed by the owner wins over the earlier norm", async () => {
    const unit = (await companyInstalledUnits(a)).find((u) => u.code === "ERP-C1-P2-1")!;
    const r = await saveMachineDetails(h.db as Db, { companyId: a, unit, details: { code: unit.code, installedOn: null, warrantyEnd: "2026-01-31", service: "No contract", expectedMonthly: 400 } });
    expect(r).toEqual({ ok: true });
    const after = (await companyInstalledUnits(a)).find((u) => u.code === "ERP-C1-P2-1")!;
    expect(after).toMatchObject({ source: "manual", warrantyEnd: "2026-01-31", service: "No contract", expectedMonthly: 400, installedOn: "2024-03-01", productCode: "P2" });
    expect((await companyInstalledUnits(a)).length).toBe(2);
    const c1 = (await companyInstalledBase(a, TODAY)).accounts.find((x) => x.customerCode === "C1")!;
    expect(c1).toMatchObject({ expectedMonthly: 400, expectedSource: "typed" });
  });

  it("keeps what is recorded when a later entry leaves a field empty", async () => {
    const unit = (await companyInstalledUnits(a)).find((u) => u.code === "ERP-C1-P2-1")!;
    await saveMachineDetails(h.db as Db, { companyId: a, unit, details: { code: unit.code, installedOn: null, warrantyEnd: null, service: "Active", expectedMonthly: null } });
    const after = (await companyInstalledUnits(a)).find((u) => u.code === "ERP-C1-P2-1")!;
    expect(after).toMatchObject({ service: "Active", warrantyEnd: "2026-01-31", expectedMonthly: 400 });
    expect((await q<{ n: string }>(`select count(*)::text n from installed_units where company_id = '${a}'`))[0]!.n).toBe("1");
  });
});
