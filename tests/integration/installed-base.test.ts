/**
 * The Installed base query against a real Postgres engine (PGlite): the 90-day window ending at the newest invoice,
 * consumables only, returns taken off, and one company never sees another's units or sales.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { runImport, type Db } from "@/db/import-writer";
import { companyInstalledBase, companyInstalledUnits } from "@/lib/installed-base";

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db/client", () => ({ getDb: () => h.db }));

let client: PGlite;
let a: string;
let b: string;
const TODAY = "2026-10-20";
const q = async <T>(sql: string, args: unknown[] = []) => (await client.query<T>(sql, args)).rows;
const imp = (companyId: string, kind: Parameters<typeof runImport>[1]["kind"], text: string) =>
  runImport(h.db as Db, { companyId, userId: null, kind, fileName: `${kind}-${Math.random()}.csv`, text, today: TODAY, dryRun: false });

beforeAll(async () => {
  client = new PGlite();
  h.db = drizzle(client, { schema });
  const dir = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(dir + f, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) await client.exec(stmt);
  }
  const create = async (slug: string) => (await q<{ id: string }>("insert into companies (slug, name) values ($1, $1) returning id", [slug]))[0]!.id;
  a = await create("ib-a");
  b = await create("ib-b");

  await imp(a, "products", "code,name,category,unit\nP1,Reagent,Consumables,pack\nP2,Analyzer,Equipment,");
  await imp(a, "customers", "code,name,segment\nC1,Hospital A,Tender\nC2,Clinic B,Private");
  await imp(
    a,
    "sales",
    [
      "invoice no,line no,date,customer code,product code,qty,net sales,cost",
      // Inside the window (newest invoice 2026-10-10 => window starts 2026-07-13): 600 + 300 consumables, less a 60 return.
      "I1,1,2026-09-01,C1,P1,10,600,300",
      "I2,1,2026-10-10,C1,P1,5,300,150",
      "R1,1,2026-10-05,C1,P1,-1,-60,-30",
      // Equipment is not consumables; an old invoice is outside the window.
      "I3,1,2026-09-15,C1,P2,1,5000,3000",
      "OLD,1,2026-05-01,C1,P1,50,9000,5000",
    ].join("\n"),
  );
  await imp(
    a,
    "installed_units",
    "unit code,customer code,product code,name,installed on,warranty end,service,expected monthly consumables\nU1,C1,P2,Analyzer,2024-01-01,2026-06-01,No contract,400\nU2,C1,P2,Second analyzer,2025-01-01,2028-01-01,Active,200\nU3,C2,,Reader,,,,",
  );

  await imp(b, "products", "code,name,category,unit\nP1,Reagent,Consumables,pack");
  await imp(b, "customers", "code,name,segment\nC1,Other hospital,Tender");
  await imp(b, "sales", "invoice no,line no,date,customer code,product code,qty,net sales,cost\nI1,1,2026-10-01,C1,P1,10,99999,1");
  await imp(b, "installed_units", "unit code,customer code,name,expected monthly consumables\nX1,C1,Their analyzer,5000");
}, 60_000);
afterAll(async () => client.close());

describe("companyInstalledBase", () => {
  it("sets a customer's combined estimate against its consumables in the 90 days to the newest invoice", async () => {
    const r = await companyInstalledBase(a, TODAY);
    expect(r.window).toEqual({ from: "2026-07-13", to: "2026-10-10" });
    const c1 = r.accounts.find((x) => x.customerCode === "C1")!;
    // (600 + 300 - 60) over 90 days, as a 30-day month = 280.
    expect(c1.actualMonthly).toBeCloseTo(280, 5);
    expect(c1.expectedMonthly).toBe(600);
    expect(c1.gapMonthly).toBeCloseTo(320, 5);
    expect(c1.units.map((u) => u.code).sort()).toEqual(["U1", "U2"]);
    expect(c1.units.find((u) => u.code === "U1")!.flags.map((f) => f.kind)).toEqual(["warranty_ended", "service"]);
  });

  it("lists a unit with no estimate but leaves it out of the totals", async () => {
    const r = await companyInstalledBase(a, TODAY);
    expect(r.accounts.find((x) => x.customerCode === "C2")).toMatchObject({ expectedMonthly: null, actualMonthly: 0, gapMonthly: null });
    expect(r.totals).toMatchObject({ units: 3, customers: 2, customersWithEstimate: 1, unitsWithoutEstimate: 1 });
    expect(r.totals.gapMonthly).toBeCloseTo(320, 5);
  });

  it("never mixes in another company", async () => {
    const r = await companyInstalledBase(b, TODAY);
    expect(r.totals.units).toBe(1);
    expect(r.accounts[0]!.units[0]!.code).toBe("X1");
    expect(r.accounts[0]!.actualMonthly).toBeCloseTo((99999 * 30) / 90, 3);
  });

  it("returns an empty base for a company with no equipment", async () => {
    const none = (await q<{ id: string }>("insert into companies (slug, name) values ('ib-none', 'none') returning id"))[0]!.id;
    const r = await companyInstalledBase(none, TODAY);
    expect(r.totals.units).toBe(0);
    expect(r.accounts).toEqual([]);
  });
});

describe("companyInstalledUnits", () => {
  it("lists one company's units with their customer and recorded service status, and no one else's", async () => {
    const units = await companyInstalledUnits(a);
    expect(units.map((u) => u.code).sort()).toEqual(["U1", "U2", "U3"]);
    expect(units.find((u) => u.code === "U1")).toMatchObject({ customerName: "Hospital A", service: "No contract", warrantyEnd: "2026-06-01" });
    expect(units.find((u) => u.code === "U3")).toMatchObject({ service: null, warrantyEnd: null });
    expect((await companyInstalledUnits(b)).map((u) => u.code)).toEqual(["X1"]);
  });
});
