/**
 * Saved column choices against a real Postgres engine (PGlite) with the project migrations: saved for the whole
 * company, stored the way the importer compares headings, a changed choice replaces the old one, an older browser's
 * choices are taken over without overwriting the company's, and one company never sees another's.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { loadColumnChoices, saveColumnChoice, takeOverColumnChoices } from "@/db/column-choices";
import { rememberedMapping } from "@/core/import/column-map";

let client: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
let a: string;
let b: string;
let userA: string;
type Db = Parameters<typeof loadColumnChoices>[0];

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client, { schema });
  const dir = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(dir + f, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) await client.exec(stmt);
  }
  const q = async (sql: string) => (await client.query<{ id: string }>(sql)).rows[0]!.id;
  a = await q(`insert into companies (slug, name) values ('a', 'A') returning id`);
  b = await q(`insert into companies (slug, name) values ('b', 'B') returning id`);
  userA = await q(`insert into users (company_id, email, password_hash, full_name, role) values ('${a}', 'o@a.test', 'x', 'Owner A', 'owner') returning id`);
}, 60_000);
afterAll(async () => client.close());

describe("saved column choices", () => {
  it("saves a choice for the company, as the importer compares headings", async () => {
    expect(await saveColumnChoice(db as unknown as Db, { companyId: a, userId: userA, kind: "customers", fieldKey: "code", heading: "Cust. No" })).toBe(true);
    const choices = await loadColumnChoices(db as unknown as Db, a);
    expect(choices).toEqual({ customers: { custno: "code" } });
    // The upload screen finds it again for a file with the same heading, written differently.
    expect(rememberedMapping("customers", ["CUST NO", "Customer name"], choices)).toEqual({ code: "CUST NO" });
  });

  it("replaces the old heading when the person picks another column for the field", async () => {
    await saveColumnChoice(db as unknown as Db, { companyId: a, userId: userA, kind: "customers", fieldKey: "code", heading: "Client ID", previous: "Cust. No" });
    expect((await loadColumnChoices(db as unknown as Db, a)).customers).toEqual({ clientid: "code" });
  });

  it("forgets a choice when the heading is cleared, and refuses a field the type does not have", async () => {
    await saveColumnChoice(db as unknown as Db, { companyId: a, userId: userA, kind: "customers", fieldKey: "code", heading: "", previous: "Client ID" });
    expect(await loadColumnChoices(db as unknown as Db, a)).toEqual({});
    expect(await saveColumnChoice(db as unknown as Db, { companyId: a, userId: userA, kind: "customers", fieldKey: "notAField", heading: "X" })).toBe(false);
  });

  it("takes over an older browser's choices without overwriting the company's, only for allowed types", async () => {
    await saveColumnChoice(db as unknown as Db, { companyId: a, userId: userA, kind: "customers", fieldKey: "name", heading: "Client" });
    const added = await takeOverColumnChoices(db as unknown as Db, {
      companyId: a,
      userId: userA,
      kinds: ["customers"],
      remembered: { customers: { client: "code", town: "city", bogus: "notAField" }, sales: { inv: "invoiceNo" } },
    });
    expect(added).toBe(1);
    expect((await loadColumnChoices(db as unknown as Db, a)).customers).toEqual({ client: "name", town: "city" });
  });

  it("keeps each company's choices to itself", async () => {
    expect(await loadColumnChoices(db as unknown as Db, b)).toEqual({});
  });
});
