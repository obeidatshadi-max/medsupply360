/**
 * Support indicators against a real Postgres engine (PGlite) with the real migrations: add, change, record a reading,
 * delete, the duplicate-name rule, the refusal of an older measurement, and company isolation.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import type { Db } from "@/db/import-writer";
import type { IndicatorForm } from "@/core/support-indicators";
import { addIndicator, deleteIndicator, listIndicators, recordReading, updateIndicator } from "@/server/services/support-indicators";

let client: PGlite;
let db: Db;
let a: string;
let b: string;
const TODAY = "2026-10-20";
const q = async <T>(sql: string) => (await client.query<T>(sql)).rows;

const form = (over: Partial<IndicatorForm> = {}): IndicatorForm => ({
  function: "Logistics",
  name: "On-time deliveries",
  unit: "%",
  direction: "at_least",
  target: "95",
  responsible: "Operations manager",
  consequence: "",
  ...over,
});
const add = async (company: string, over: Partial<IndicatorForm> = {}) => {
  const r = await addIndicator(db, { companyId: company, form: form(over) });
  if (!r.ok) throw new Error(r.error);
  return r.id;
};

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client, { schema }) as unknown as Db;
  const dir = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(dir + f, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) await client.exec(stmt);
  }
  a = (await q<{ id: string }>(`insert into companies (slug, name) values ('a', 'A') returning id`))[0]!.id;
  b = (await q<{ id: string }>(`insert into companies (slug, name) values ('b', 'B') returning id`))[0]!.id;
}, 60_000);
afterAll(async () => client.close());

describe("support indicators", () => {
  it("adds an indicator with no reading yet", async () => {
    await add(a);
    expect(await listIndicators(db, a)).toEqual([
      expect.objectContaining({ department: "Logistics", name: "On-time deliveries", unit: "%", direction: "at_least", target: 95, actual: null, measuredOn: null, responsible: "Operations manager", consequence: null }),
    ]);
  });

  it("refuses the same name twice in one department, in any letter case, but not in another department or company", async () => {
    const dup = await addIndicator(db, { companyId: a, form: form({ name: "on-time DELIVERIES" }) });
    expect(dup).toEqual({ ok: false, error: expect.stringMatching(/already has an indicator/) });
    await add(a, { function: "Procurement" });
    await add(b);
    expect((await listIndicators(db, a)).length).toBe(2);
  });

  it("records a reading with who typed it, and keeps it when the definition changes", async () => {
    const id = (await listIndicators(db, a)).find((i) => i.department === "Logistics")!.id;
    expect(await recordReading(db, { companyId: a, id, actual: "88", measuredOn: "2026-10-10", by: "Rana Khoury", today: TODAY })).toEqual({ ok: true, id });
    expect(await updateIndicator(db, { companyId: a, id, form: form({ target: "97", responsible: "Dina Haddad" }) })).toEqual({ ok: true, id });
    expect((await listIndicators(db, a)).find((i) => i.id === id)).toMatchObject({ actual: 88, measuredOn: "2026-10-10", readingBy: "Rana Khoury", target: 97, responsible: "Dina Haddad" });
  });

  it("refuses an older measurement than the stored one and a future date, and accepts the same day", async () => {
    const id = (await listIndicators(db, a)).find((i) => i.department === "Logistics")!.id;
    expect((await recordReading(db, { companyId: a, id, actual: "70", measuredOn: "2026-10-09", by: "X Y", today: TODAY })).ok).toBe(false);
    expect((await recordReading(db, { companyId: a, id, actual: "70", measuredOn: "2026-10-21", by: "X Y", today: TODAY })).ok).toBe(false);
    expect((await recordReading(db, { companyId: a, id, actual: "91", measuredOn: "2026-10-10", by: "X Y", today: TODAY })).ok).toBe(true);
    expect((await listIndicators(db, a)).find((i) => i.id === id)!.actual).toBe(91);
  });

  it("never lets one company touch another's indicator", async () => {
    const mine = (await listIndicators(db, a))[0]!.id;
    const theirs = (await listIndicators(db, b))[0]!.id;
    expect((await updateIndicator(db, { companyId: a, id: theirs, form: form({ target: "1" }) })).ok).toBe(false);
    expect((await recordReading(db, { companyId: a, id: theirs, actual: "1", measuredOn: TODAY, by: "X Y", today: TODAY })).ok).toBe(false);
    expect((await deleteIndicator(db, { companyId: a, id: theirs })).ok).toBe(false);
    expect((await listIndicators(db, b))[0]!.target).toBe(95);
    expect(mine).not.toBe(theirs);
  });

  it("deletes an indicator and rejects an id that is not a uuid", async () => {
    const id = (await listIndicators(db, a)).find((i) => i.department === "Procurement")!.id;
    expect(await deleteIndicator(db, { companyId: a, id })).toEqual({ ok: true, id });
    expect((await listIndicators(db, a)).length).toBe(1);
    expect((await deleteIndicator(db, { companyId: a, id: "nope" })).ok).toBe(false);
  });
});
