/**
 * Tender item lines against a real Postgres engine (PGlite) with the real migrations: the list is saved and replaced as one,
 * the tender's bid and estimated values follow the lines only when every line has the price, and companies stay apart.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import type { Db } from "@/db/import-writer";
import type { ItemForm } from "@/core/tender-items";
import { listTenderItems, saveTenderItems } from "@/server/services/tender-items";
import { createTender, getTender, type TenderForm } from "@/server/services/tenders";

let client: PGlite;
let db: Db;
let a: string;
let b: string;
let userA: string;
const q = async <T>(sql: string) => (await client.query<T>(sql)).rows;

const blank: TenderForm = {
  authority: "MOH", tenderNo: "", title: "Diabetes supplies", productLine: "consumables", estimatedValue: "", deadline: "", bidValue: "", awardAmount: "", closeReason: "",
  closeReasonCode: "", winnerName: "", winningPrice: "", expectedAwardDate: "", submittedOn: "", bidOpeningDate: "", paymentTermsDays: "", contractNo: "", contractValue: "", deliveredOn: "", notes: "",
};
const line = (over: Partial<ItemForm> = {}): ItemForm => ({ itemName: "Glucose strips 50", quantity: "100", unit: "box", estimatedUnitPrice: "", ourUnitPrice: "", ...over });
const tender = async (over: Partial<TenderForm> = {}, company = a) => {
  const r = await createTender(db, { companyId: company, userId: userA, form: { ...blank, ...over }, startAs: "pipeline" });
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
  userA = (await q<{ id: string }>(`insert into users (company_id, email, password_hash, full_name, role) values ('${a}', 't@a.test', 'x', 'Lina Tender', 'tender') returning id`))[0]!.id;
}, 60_000);
afterAll(async () => client.close());

describe("tender item lines", () => {
  it("saves lines in order and reads them back with their numbers intact", async () => {
    const id = await tender();
    const r = await saveTenderItems(db, { companyId: a, tenderId: id, rows: [line({ estimatedUnitPrice: "4.500", ourUnitPrice: "4.250" }), line({ itemName: "Lancets", quantity: "2,000", unit: "", ourUnitPrice: "0.080" })] });
    expect(r).toMatchObject({ ok: true, count: 2 });
    expect(await listTenderItems(db, a, id)).toEqual([
      { itemName: "Glucose strips 50", quantity: 100, unit: "box", estimatedUnitPrice: 4.5, ourUnitPrice: 4.25 },
      { itemName: "Lancets", quantity: 2000, unit: null, estimatedUnitPrice: null, ourUnitPrice: 0.08 },
    ]);
  });

  it("replaces the whole list on every save, and an empty save clears it", async () => {
    const id = await tender({ title: "Replace me" });
    await saveTenderItems(db, { companyId: a, tenderId: id, rows: [line(), line({ itemName: "B" }), line({ itemName: "C" })] });
    await saveTenderItems(db, { companyId: a, tenderId: id, rows: [line({ itemName: "Only one" })] });
    expect((await listTenderItems(db, a, id)).map((i) => i.itemName)).toEqual(["Only one"]);
    expect(await saveTenderItems(db, { companyId: a, tenderId: id, rows: [line({ itemName: "", quantity: "", unit: "" })] })).toMatchObject({ ok: true, count: 0 });
    expect(await listTenderItems(db, a, id)).toEqual([]);
  });

  it("sets the tender's bid and estimated values from the lines only when every line has that price", async () => {
    const id = await tender({ title: "Totals", estimatedValue: "9999", bidValue: "8888" });
    // one line unpriced: the values the tender already has are kept
    await saveTenderItems(db, { companyId: a, tenderId: id, rows: [line({ ourUnitPrice: "4.250", estimatedUnitPrice: "4.500" }), line({ itemName: "Lancets", quantity: "10" })] });
    expect((await getTender(db, a, id))!.tender).toMatchObject({ bidValue: 8888, estimatedValue: 9999 });
    // every line priced: both follow the lines
    const r = await saveTenderItems(db, { companyId: a, tenderId: id, rows: [line({ ourUnitPrice: "4.250", estimatedUnitPrice: "4.500" }), line({ itemName: "Lancets", quantity: "10", ourUnitPrice: "0.080", estimatedUnitPrice: "0.100" })] });
    expect(r).toMatchObject({ ok: true, bidValue: 425.8, estimatedValue: 451 });
    expect((await getTender(db, a, id))!.tender).toMatchObject({ bidValue: 425.8, estimatedValue: 451 });
  });

  it("refuses a bad line, names it, and changes nothing", async () => {
    const id = await tender({ title: "Bad line" });
    await saveTenderItems(db, { companyId: a, tenderId: id, rows: [line({ itemName: "Keep me" })] });
    const r = await saveTenderItems(db, { companyId: a, tenderId: id, rows: [line({ itemName: "New" }), line({ quantity: "zero" })] });
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/^Line 2: the quantity/) });
    expect((await listTenderItems(db, a, id)).map((i) => i.itemName)).toEqual(["Keep me"]);
  });

  it("keeps companies apart", async () => {
    const id = await tender({ title: "Mine" });
    await saveTenderItems(db, { companyId: a, tenderId: id, rows: [line()] });
    expect(await saveTenderItems(db, { companyId: b, tenderId: id, rows: [line()] })).toEqual({ ok: false, error: "That tender was not found." });
    expect(await listTenderItems(db, b, id)).toEqual([]);
    expect(await listTenderItems(db, a, id)).toHaveLength(1);
  });
});
