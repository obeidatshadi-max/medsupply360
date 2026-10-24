/**
 * Part deliveries against a real Postgres engine (PGlite) with the real migrations: a delivery needs a contract, dates and
 * values are checked, deliveries add up per tender, and companies stay apart.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import type { Db } from "@/db/import-writer";
import { deliveryProgress } from "@/core/tender-deliveries";
import { addDelivery, deleteDelivery, listDeliveries } from "@/server/services/tender-deliveries";
import { companyTenderOverview } from "@/server/services/tender-overview";

let client: PGlite;
let db: Db;
let a: string;
let b: string;
let user: string;
const q = async <T>(sql: string) => (await client.query<T>(sql)).rows;

const tender = async (status: string, contractValue: number | null, company = a) =>
  (await q<{ id: string }>(`insert into tenders (company_id, authority, title, product_line, status, contract_value) values ('${company}', 'MOH', 'T ${Math.random()}', 'equipment', '${status}', ${contractValue ?? "null"}) returning id`))[0]!.id;
const add = (tenderId: string, over: Partial<{ deliveredOn: string; value: string; note: string }> = {}, company = a) =>
  addDelivery(db, { companyId: company, userId: user, tenderId, form: { deliveredOn: "2026-10-01", value: "1000", note: "", ...over } });

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client, { schema }) as unknown as Db;
  const dir = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(dir + f, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) await client.exec(stmt);
  }
  a = (await q<{ id: string }>(`insert into companies (slug, name) values ('a', 'A') returning id`))[0]!.id;
  b = (await q<{ id: string }>(`insert into companies (slug, name) values ('b', 'B') returning id`))[0]!.id;
  user = (await q<{ id: string }>(`insert into users (company_id, email, password_hash, full_name, role) values ('${a}', 't@a.test', 'x', 'Lina Tender', 'tender') returning id`))[0]!.id;
}, 60_000);
afterAll(async () => client.close());

describe("part deliveries", () => {
  it("only accepts deliveries once the tender is contracted (or delivered, for a late correction)", async () => {
    for (const status of ["pipeline", "open", "submitted", "won", "lost"]) {
      expect(await add(await tender(status, 100))).toEqual({ ok: false, error: "Deliveries can be recorded once the tender is contracted." });
    }
    expect((await add(await tender("contracted", 100))).ok).toBe(true);
    expect((await add(await tender("delivered", 100))).ok).toBe(true);
  });

  it("lists deliveries oldest first and adds them up with the contract value", async () => {
    const id = await tender("contracted", 141300);
    await add(id, { deliveredOn: "2026-10-05", value: "41,300", note: "Second batch" });
    await add(id, { deliveredOn: "2026-09-28", value: "60000", note: "  First batch  " });
    const rows = await listDeliveries(db, a, id);
    expect(rows.map((r) => [r.deliveredOn, r.value, r.note])).toEqual([["2026-09-28", 60000, "First batch"], ["2026-10-05", 41300, "Second batch"]]);
    expect(deliveryProgress(141300, rows)).toMatchObject({ deliveredValue: 101300, outstanding: 40000, percent: 71.7 });
  });

  it("checks the date and the value, and writes nothing when they are wrong", async () => {
    const id = await tender("contracted", 100);
    expect(await add(id, { deliveredOn: "" })).toEqual({ ok: false, error: "Enter the delivery date." });
    expect(await add(id, { deliveredOn: "1/10/2026" })).toEqual({ ok: false, error: "Enter the delivery date." });
    expect(await add(id, { deliveredOn: "2999-01-01" })).toEqual({ ok: false, error: "The delivery date cannot be in the future." });
    expect((await add(id, { value: "lots" })).ok).toBe(false);
    expect(await add(id, { value: "0" })).toEqual({ ok: false, error: "The value delivered must be above zero, or left empty." });
    expect((await add(id, { value: "-5" })).ok).toBe(false);
    expect((await add(id, { note: "x".repeat(501) })).ok).toBe(false);
    expect(await listDeliveries(db, a, id)).toEqual([]);
  });

  it("accepts a delivery with no value, and above the contract value, without refusing either", async () => {
    const id = await tender("contracted", 100);
    expect((await add(id, { value: "" })).ok).toBe(true);
    expect((await add(id, { value: "250" })).ok).toBe(true);
    expect(deliveryProgress(100, await listDeliveries(db, a, id))).toMatchObject({ count: 2, withoutValue: 1, overDelivered: 150, outstanding: 0 });
  });

  it("removes one delivery, and keeps companies apart", async () => {
    const id = await tender("contracted", 100);
    const r = await add(id);
    if (!r.ok) throw new Error(r.error);
    expect(await add(id, {}, b)).toEqual({ ok: false, error: "That tender was not found." });
    expect(await deleteDelivery(db, { companyId: b, tenderId: id, deliveryId: r.id })).toEqual({ ok: false, error: "That delivery was not found." });
    expect(await listDeliveries(db, b, id)).toEqual([]);
    expect(await listDeliveries(db, a, id)).toHaveLength(1);
    expect(await deleteDelivery(db, { companyId: a, tenderId: id, deliveryId: r.id })).toEqual({ ok: true, id: r.id });
    expect(await listDeliveries(db, a, id)).toEqual([]);
  });
});

describe("overview of contracted tenders still to deliver", () => {
  it("shows each contracted tender's delivered share from the stored deliveries", async () => {
    const c = (await q<{ id: string }>(`insert into companies (slug, name) values ('c', 'C') returning id`))[0]!.id;
    const half = await tender("contracted", 2000, c);
    const none = await tender("contracted", 500, c);
    await tender("delivered", 9000, c);
    await client.exec(`insert into tender_deliveries (company_id, tender_id, delivered_on, value) values ('${c}', '${half}', '2026-10-01', 600), ('${c}', '${half}', '2026-10-02', 400)`);
    const o = await companyTenderOverview(db, c, "2026-10-18");
    expect(o.toDeliver).toMatchObject({ count: 2, contractValue: 2500, delivered: 1000, outstanding: 1500 });
    expect(o.toDeliver.items.map((x) => [x.id, x.percent, x.outstanding])).toEqual([[half, 50, 1000], [none, 0, 500]]);
  });
});
