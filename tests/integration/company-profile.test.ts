/**
 * The company profile against a real Postgres engine (PGlite) with the real migrations: first save, replace, validation,
 * the supplier list from the product list, and company isolation.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import type { Db } from "@/db/import-writer";
import { emptyProfile, type ProfileForm } from "@/core/company-profile";
import { getProfile, listSuppliers, saveProfile } from "@/server/services/company-profile";

let client: PGlite;
let db: Db;
let a: string;
let b: string;
const q = async <T>(sql: string) => (await client.query<T>(sql)).rows;
const form = (over: Partial<ProfileForm> = {}): ProfileForm => ({ ...emptyProfile, companyName: "Distributor A", location: "Jordan", founded: "2008", erp: "Alpha ERP", purpose: "Distributing medical brands", ...over });

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client, { schema }) as unknown as Db;
  const dir = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(dir + f, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) await client.exec(stmt);
  }
  a = (await q<{ id: string }>(`insert into companies (slug, name) values ('a', 'Company A') returning id`))[0]!.id;
  b = (await q<{ id: string }>(`insert into companies (slug, name) values ('b', 'Company B') returning id`))[0]!.id;
}, 60_000);
afterAll(async () => client.close());

describe("company profile", () => {
  it("is empty, with the company name, before anything is written", async () => {
    expect(await getProfile(db, a)).toEqual({ ...emptyProfile, companyName: "Company A", updatedBy: null, updatedAt: null });
  });

  it("saves, then replaces, and records who and when", async () => {
    expect(await saveProfile(db, { companyId: a, form: form(), by: "Sami Nasser", thisYear: 2026 })).toEqual({ ok: true });
    expect(await getProfile(db, a)).toMatchObject({ location: "Jordan", founded: "2008", erp: "Alpha ERP", updatedBy: "Sami Nasser" });
    await saveProfile(db, { companyId: a, form: form({ location: "Amman", purpose: "" }), by: "Rana Khoury", thisYear: 2026 });
    const p = await getProfile(db, a);
    expect(p).toMatchObject({ location: "Amman", purpose: "", updatedBy: "Rana Khoury" });
    expect(p!.updatedAt).toBeInstanceOf(Date);
    expect((await q<{ n: string }>(`select count(*)::text n from company_profiles where company_id = '${a}'`))[0]!.n).toEqual(expect.stringMatching(/^1$/));
  });

  it("renames the company with the profile, so the name the owner typed is the one shown", async () => {
    await saveProfile(db, { companyId: a, form: form({ companyName: "Renamed Distributor", location: "Amman", purpose: "" }), by: "Sami Nasser", thisYear: 2026 });
    expect((await getProfile(db, a))!.companyName).toBe("Renamed Distributor");
    expect((await q<{ name: string }>(`select name from companies where id = '${a}'`))[0]!.name).toBe("Renamed Distributor");
    expect((await q<{ name: string }>(`select name from companies where id = '${b}'`))[0]!.name).toBe("Company B");
  });

  it("refuses an invalid year and leaves the stored profile alone", async () => {
    const r = await saveProfile(db, { companyId: a, form: form({ founded: "2090", location: "Elsewhere" }), by: "X Y", thisYear: 2026 });
    expect(r.ok).toBe(false);
    expect((await getProfile(db, a))!.location).toBe("Amman");
  });

  it("keeps companies apart and returns null for an unknown company", async () => {
    await saveProfile(db, { companyId: b, form: form({ location: "Baghdad" }), by: "Other Person", thisYear: 2026 });
    expect((await getProfile(db, a))!.location).toBe("Amman");
    expect((await getProfile(db, b))!.location).toBe("Baghdad");
    expect(await getProfile(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("lists suppliers from the product list with product counts, biggest first, leaving out products with no supplier", async () => {
    await q(`insert into products (company_id, code, name, line, supplier_name, active) values
      ('${a}', 'P1', 'A', 'Consumables', 'Sysmex', true), ('${a}', 'P2', 'B', 'Consumables', 'Sysmex', false), ('${a}', 'P3', 'C', 'Equipment', 'Roche', true),
      ('${a}', 'P4', 'D', 'Devices', null, true), ('${b}', 'P1', 'E', 'Consumables', 'Other supplier', true)`);
    expect(await listSuppliers(db, a)).toEqual([
      { name: "Sysmex", products: 2, activeProducts: 1 },
      { name: "Roche", products: 1, activeProducts: 1 },
    ]);
    expect(await listSuppliers(db, b)).toEqual([{ name: "Other supplier", products: 1, activeProducts: 1 }]);
  });
});
