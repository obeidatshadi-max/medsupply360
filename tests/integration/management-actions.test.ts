/**
 * Management actions against a real Postgres engine (PGlite) with the real migrations: add, finish, reopen, remove,
 * validation, and company isolation.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import type { Db } from "@/db/import-writer";
import type { ActionForm } from "@/core/management-actions";
import { addAction, listActions, removeAction, setActionDone } from "@/server/services/management-actions";

let client: PGlite;
let db: Db;
let a: string;
let b: string;
const q = async <T>(sql: string) => (await client.query<T>(sql)).rows;
const form = (over: Partial<ActionForm> = {}): ActionForm => ({ title: "Convert uncovered service agreements", responsible: "Service manager", due: "2026-11-01", evidence: "4 machines with no contract", ...over });
const add = async (company: string, over: Partial<ActionForm> = {}) => {
  const r = await addAction(db, { companyId: company, form: form(over), by: "Sami Nasser" });
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

describe("management actions", () => {
  it("adds an open action with who added it", async () => {
    await add(a);
    expect(await listActions(db, a)).toEqual([
      expect.objectContaining({ title: "Convert uncovered service agreements", responsible: "Service manager", due: "2026-11-01", status: "open", evidence: "4 machines with no contract", createdBy: "Sami Nasser", completedOn: null, completedBy: null }),
    ]);
  });

  it("refuses an invalid action and saves nothing", async () => {
    const r = await addAction(db, { companyId: a, form: form({ responsible: "Nobody" }), by: "X Y" });
    expect(r.ok).toBe(false);
    expect((await listActions(db, a)).length).toBe(1);
  });

  it("finishes an action with the day and the person, and reopening clears both", async () => {
    const id = (await listActions(db, a))[0]!.id;
    expect(await setActionDone(db, { companyId: a, id, done: true, by: "Rana Khoury", today: "2026-10-20" })).toEqual({ ok: true, id });
    expect((await listActions(db, a))[0]).toMatchObject({ status: "done", completedOn: "2026-10-20", completedBy: "Rana Khoury" });
    await setActionDone(db, { companyId: a, id, done: false, by: "Rana Khoury", today: "2026-10-21" });
    expect((await listActions(db, a))[0]).toMatchObject({ status: "open", completedOn: null, completedBy: null });
  });

  it("lists by due date", async () => {
    await add(a, { title: "Review emergency freight", due: "2026-10-05" });
    expect((await listActions(db, a)).map((x) => x.due)).toEqual(["2026-10-05", "2026-11-01"]);
  });

  it("never lets one company touch another's action", async () => {
    const theirs = await add(b, { title: "Their action" });
    expect((await setActionDone(db, { companyId: a, id: theirs, done: true, by: "X Y", today: "2026-10-20" })).ok).toBe(false);
    expect((await removeAction(db, { companyId: a, id: theirs })).ok).toBe(false);
    expect((await listActions(db, b))[0]!.status).toBe("open");
  });

  it("removes an action and rejects an id that is not a uuid", async () => {
    const id = (await listActions(db, a))[0]!.id;
    expect(await removeAction(db, { companyId: a, id })).toEqual({ ok: true, id });
    expect((await listActions(db, a)).length).toBe(1);
    expect((await removeAction(db, { companyId: a, id: "nope" })).ok).toBe(false);
  });
});
