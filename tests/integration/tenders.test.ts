/**
 * Tenders against a real Postgres engine (PGlite) with the real migrations: creation, the status flow and who may make
 * each move, required fields, company isolation, the history log and the duplicate-number rule.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import type { Db } from "@/db/import-writer";
import { createTender, getTender, listTenders, moveTender, parseJod, updateTender, type TenderForm } from "@/server/services/tenders";

let client: PGlite;
let db: Db;
let a: string;
let b: string;
let userA: string;
const q = async <T>(sql: string) => (await client.query<T>(sql)).rows;

const blank: TenderForm = { authority: "MOH", tenderNo: "", title: "", productLine: "equipment", estimatedValue: "", deadline: "", bidValue: "", awardAmount: "", closeReason: "", contractNo: "", contractValue: "", deliveredOn: "", notes: "" };
const form = (over: Partial<TenderForm> = {}): TenderForm => ({ ...blank, title: "Analyzer for central lab", ...over });

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

const create = async (over: Partial<TenderForm> = {}, startAs: "pipeline" | "open" = "pipeline") => {
  const r = await createTender(db, { companyId: a, userId: userA, form: form(over), startAs });
  if (!r.ok) throw new Error(r.error);
  return r.id;
};

describe("parseJod", () => {
  it("reads amounts with commas, treats blank as unknown and refuses the rest", () => {
    expect(parseJod("12,500.250")).toBe(12500.25);
    expect(parseJod("  ")).toBeNull();
    expect(parseJod(undefined)).toBeNull();
    expect(parseJod("12.5555")).toBe("invalid");
    expect(parseJod("-5")).toBe("invalid");
    expect(parseJod("abc")).toBe("invalid");
  });
});

describe("creating tenders", () => {
  it("records a pipeline opportunity with a history entry", async () => {
    const id = await create();
    const got = await getTender(db, a, id);
    expect(got!.tender).toMatchObject({ status: "pipeline", authority: "MOH", title: "Analyzer for central lab", tenderNo: null });
    expect(got!.history).toHaveLength(1);
    expect(got!.history[0]).toMatchObject({ fromStatus: null, toStatus: "pipeline", by: "Lina Tender" });
  });

  it("needs number, value and deadline to record an announced tender", async () => {
    const r = await createTender(db, { companyId: a, userId: userA, form: form(), startAs: "open" });
    expect(r).toEqual({ ok: false, error: "To record an announced tender, also enter: tender number, estimated value, submission deadline." });
    const id = await create({ tenderNo: "MOH-2026-14", estimatedValue: "250,000", deadline: "2026-11-20" }, "open");
    expect((await getTender(db, a, id))!.tender).toMatchObject({ status: "open", estimatedValue: 250000, deadline: "2026-11-20" });
  });

  it("rejects an unknown authority, a missing title, a bad amount and a bad date", async () => {
    for (const over of [{ authority: "XYZ" }, { title: " " }, { estimatedValue: "lots" }, { deadline: "31/12/2026" }, { productLine: "cars" }]) {
      expect((await createTender(db, { companyId: a, userId: userA, form: form(over), startAs: "pipeline" })).ok).toBe(false);
    }
  });

  it("refuses a second tender with the same number at the same authority, but allows it at another", async () => {
    await create({ tenderNo: "DUP-1" });
    const same = await createTender(db, { companyId: a, userId: userA, form: form({ tenderNo: "DUP-1" }), startAs: "pipeline" });
    expect(same).toEqual({ ok: false, error: "A tender with this number already exists for this authority." });
    expect((await createTender(db, { companyId: a, userId: userA, form: form({ tenderNo: "DUP-1", authority: "KHCC" }), startAs: "pipeline" })).ok).toBe(true);
  });
});

describe("moving tenders", () => {
  const move = (id: string, to: Parameters<typeof moveTender>[1]["to"], seen: Parameters<typeof moveTender>[1]["seenStatus"], over: Partial<TenderForm> = {}, role: Parameters<typeof moveTender>[1]["role"] = "tender", companyId = a) =>
    moveTender(db, { companyId, userId: userA, role, tenderId: id, to, seenStatus: seen, form: form(over), note: "" });

  it("walks a tender from pipeline to collected, asking for each stage's details and logging every step", async () => {
    const id = await create({ tenderNo: "FLOW-1", estimatedValue: "100000", deadline: "2026-12-01" });
    const keep = { tenderNo: "FLOW-1", estimatedValue: "100000", deadline: "2026-12-01" };
    expect((await move(id, "open", "pipeline", keep)).ok).toBe(true);
    expect((await move(id, "preparing", "open", keep)).ok).toBe(true);
    expect(await move(id, "submitted", "preparing", keep)).toEqual({ ok: false, error: "Before moving to Submitted, enter: bid value." });
    const bid = { ...keep, bidValue: "95000" };
    expect((await move(id, "submitted", "preparing", bid)).ok).toBe(true);
    expect((await move(id, "technical_review", "submitted", bid)).ok).toBe(true);
    expect((await move(id, "financial_review", "technical_review", bid)).ok).toBe(true);
    const won = { ...bid, awardAmount: "94000" };
    expect((await move(id, "won", "financial_review", won)).ok).toBe(true);
    const con = { ...won, contractNo: "PO-77", contractValue: "94000" };
    expect((await move(id, "contracted", "won", con)).ok).toBe(true);
    const del = { ...con, deliveredOn: "2027-02-01" };
    expect((await move(id, "delivered", "contracted", del)).ok).toBe(true);
    expect(await move(id, "collected", "delivered", del, "tender")).toEqual({ ok: false, error: "Your role cannot make this change." });
    expect((await move(id, "collected", "delivered", del, "finance")).ok).toBe(true);

    const got = await getTender(db, a, id);
    expect(got!.tender).toMatchObject({ status: "collected", bidValue: 95000, awardAmount: 94000, contractNo: "PO-77", deliveredOn: "2027-02-01" });
    expect(got!.history.map((h) => h.toStatus)).toEqual(["pipeline", "open", "preparing", "submitted", "technical_review", "financial_review", "won", "contracted", "delivered", "collected"]);
    expect(await move(id, "delivered", "collected", del, "tender")).toEqual({ ok: false, error: "Your role cannot make this change." });
  });

  it("refuses an illegal jump and a stale page", async () => {
    const id = await create({ tenderNo: "JUMP-1", estimatedValue: "1", deadline: "2026-12-01" });
    expect(await move(id, "won", "pipeline")).toEqual({ ok: false, error: "A tender cannot go from Pipeline to Won." });
    await move(id, "open", "pipeline", { tenderNo: "JUMP-1", estimatedValue: "1", deadline: "2026-12-01" });
    expect(await move(id, "cancelled", "pipeline", { closeReason: "x" })).toEqual({ ok: false, error: "Someone already moved this tender to Open. Reload the page." });
  });

  it("needs a reason to mark a tender lost or cancelled, and keeps it final", async () => {
    const id = await create({ tenderNo: "LOST-1", estimatedValue: "1", deadline: "2026-12-01" });
    expect(await move(id, "cancelled", "pipeline")).toEqual({ ok: false, error: "Before moving to Cancelled, enter: reason it was cancelled or dropped." });
    expect((await move(id, "cancelled", "pipeline", { closeReason: "Authority withdrew the tender" })).ok).toBe(true);
    expect((await getTender(db, a, id))!.tender).toMatchObject({ status: "cancelled", closeReason: "Authority withdrew the tender" });
    expect((await move(id, "pipeline", "cancelled")).ok).toBe(false);
  });

  it("lets a tender step back one stage without asking for anything", async () => {
    const id = await create({ tenderNo: "BACK-1", estimatedValue: "1", deadline: "2026-12-01" });
    await move(id, "open", "pipeline", { tenderNo: "BACK-1", estimatedValue: "1", deadline: "2026-12-01" });
    expect((await move(id, "pipeline", "open", { tenderNo: "BACK-1" })).ok).toBe(true);
    expect((await getTender(db, a, id))!.tender.status).toBe("pipeline");
  });

  it("does not let the administrator or a viewer move anything", async () => {
    const id = await create();
    expect(await move(id, "cancelled", "pipeline", { closeReason: "x" }, "admin")).toEqual({ ok: false, error: "Your role cannot make this change." });
    expect((await move(id, "cancelled", "pipeline", { closeReason: "x" }, "viewer")).ok).toBe(false);
  });

  it("cannot reach another company's tender", async () => {
    const id = await create();
    expect(await move(id, "cancelled", "pipeline", { closeReason: "x" }, "owner", b)).toEqual({ ok: false, error: "That tender was not found." });
    expect(await getTender(db, b, id)).toBeNull();
    expect(await listTenders(db, b)).toEqual([]);
    expect(await getTender(db, a, "not-a-uuid")).toBeNull();
  });
});

describe("editing details", () => {
  it("saves corrections without touching the status or the history", async () => {
    const id = await create({ title: "Old title" });
    const before = (await getTender(db, a, id))!;
    expect((await updateTender(db, { companyId: a, tenderId: id, form: form({ title: "New title", notes: "Call the buyer", estimatedValue: "7,500" }) })).ok).toBe(true);
    const after = (await getTender(db, a, id))!;
    expect(after.tender).toMatchObject({ title: "New title", notes: "Call the buyer", estimatedValue: 7500, status: "pipeline" });
    expect(after.history).toHaveLength(before.history.length);
    expect(await updateTender(db, { companyId: b, tenderId: id, form: form() })).toEqual({ ok: false, error: "That tender was not found." });
  });
});
