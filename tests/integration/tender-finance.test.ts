/**
 * Guarantees, invoices and payment collection on tenders, against a real Postgres engine (PGlite) with the real
 * migrations: validation, company isolation, when invoices may be recorded, and the rule that a tender is Collected only
 * once its invoices are paid in full.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import type { Db } from "@/db/import-writer";
import { addGuarantee, addInvoice, deleteGuarantee, deleteInvoice, erpFactsByInvoiceNo, listGuarantees, listInvoices, setCollected, updateGuarantee, type GuaranteeForm } from "@/server/services/tender-finance";
import { createTender, moveTender, type TenderForm } from "@/server/services/tenders";

let client: PGlite;
let db: Db;
let a: string;
let b: string;
let user: string;
const q = async <T>(sql: string) => (await client.query<T>(sql)).rows;

const tenderForm: TenderForm = { authority: "KHCC", tenderNo: "", title: "Reagents 2026", productLine: "consumables", estimatedValue: "", deadline: "", bidValue: "", awardAmount: "", closeReason: "", closeReasonCode: "", winnerName: "", winningPrice: "", expectedAwardDate: "", submittedOn: "", bidOpeningDate: "", paymentTermsDays: "", contractNo: "", contractValue: "", deliveredOn: "", notes: "" };
const g = (over: Partial<GuaranteeForm> = {}): GuaranteeForm => ({ kind: "bid", amount: "5,000", issuedOn: "2026-10-01", expiresOn: "2027-01-01", returnedOn: "", reference: "BG-1", ...over });

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client, { schema }) as unknown as Db;
  const dir = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(dir + f, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) await client.exec(stmt);
  }
  a = (await q<{ id: string }>(`insert into companies (slug, name) values ('a', 'A') returning id`))[0]!.id;
  b = (await q<{ id: string }>(`insert into companies (slug, name) values ('b', 'B') returning id`))[0]!.id;
  user = (await q<{ id: string }>(`insert into users (company_id, email, password_hash, full_name, role) values ('${a}', 'f@a.test', 'x', 'Finance A', 'finance') returning id`))[0]!.id;
}, 60_000);
afterAll(async () => client.close());

const newTender = async () => {
  const r = await createTender(db, { companyId: a, userId: user, form: tenderForm, startAs: "pipeline" });
  if (!r.ok) throw new Error(r.error);
  return r.id;
};

/** Takes a tender all the way to Delivered as the owner so invoices can be recorded. */
const deliveredTender = async () => {
  const id = await newTender();
  const full = { ...tenderForm, tenderNo: `T-${id.slice(0, 6)}`, estimatedValue: "1000", deadline: "2026-12-01", bidValue: "900", awardAmount: "900", contractNo: "PO-1", contractValue: "900", deliveredOn: "2027-01-10" };
  for (const [to, seen] of [["open", "pipeline"], ["preparing", "open"], ["submitted", "preparing"], ["technical_review", "submitted"], ["financial_review", "technical_review"], ["won", "financial_review"], ["contracted", "won"], ["delivered", "contracted"]] as const) {
    const r = await moveTender(db, { companyId: a, userId: user, role: "owner", tenderId: id, to, seenStatus: seen, form: full, note: "" });
    if (!r.ok) throw new Error(r.error);
  }
  return { id, full };
};

describe("guarantees", () => {
  it("adds, lists, updates and removes a guarantee", async () => {
    const t = await newTender();
    const added = await addGuarantee(db, { companyId: a, userId: user, tenderId: t, form: g() });
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(await listGuarantees(db, a, t)).toEqual([{ id: added.id, kind: "bid", amount: 5000, issuedOn: "2026-10-01", expiresOn: "2027-01-01", returnedOn: null, reference: "BG-1" }]);
    expect((await updateGuarantee(db, { companyId: a, tenderId: t, guaranteeId: added.id, form: g({ returnedOn: "2026-12-20" }) })).ok).toBe(true);
    expect((await listGuarantees(db, a, t))[0]!.returnedOn).toBe("2026-12-20");
    expect((await deleteGuarantee(db, { companyId: a, tenderId: t, guaranteeId: added.id })).ok).toBe(true);
    expect(await listGuarantees(db, a, t)).toEqual([]);
  });

  it("rejects a bad kind, amount, expiry or date order", async () => {
    const t = await newTender();
    const bad = async (over: Partial<GuaranteeForm>) => (await addGuarantee(db, { companyId: a, userId: user, tenderId: t, form: g(over) })).ok;
    expect(await bad({ kind: "cash" })).toBe(false);
    expect(await bad({ amount: "0" })).toBe(false);
    expect(await bad({ amount: "-5" })).toBe(false);
    expect(await bad({ amount: "" })).toBe(false);
    expect(await bad({ expiresOn: "" })).toBe(false);
    expect(await bad({ expiresOn: "2026-09-01" })).toBe(false);
    expect(await bad({ returnedOn: "2026-09-01" })).toBe(false);
    expect(await listGuarantees(db, a, t)).toEqual([]);
  });

  it("is invisible and untouchable from another company", async () => {
    const t = await newTender();
    const added = await addGuarantee(db, { companyId: a, userId: user, tenderId: t, form: g() });
    if (!added.ok) throw new Error(added.error);
    expect(await addGuarantee(db, { companyId: b, userId: user, tenderId: t, form: g() })).toEqual({ ok: false, error: "That tender was not found." });
    expect(await listGuarantees(db, b, t)).toEqual([]);
    expect((await updateGuarantee(db, { companyId: b, tenderId: t, guaranteeId: added.id, form: g({ amount: "1" }) })).ok).toBe(false);
    expect((await deleteGuarantee(db, { companyId: b, tenderId: t, guaranteeId: added.id })).ok).toBe(false);
    expect((await listGuarantees(db, a, t))[0]!.amount).toBe(5000);
  });
});

describe("invoices and collection", () => {
  it("only accepts invoices once the tender is contracted", async () => {
    const early = await newTender();
    expect(await addInvoice(db, { companyId: a, userId: user, tenderId: early, form: { invoiceNo: "I-1", invoiceDate: "2027-02-01", amount: "100" } })).toEqual({ ok: false, error: "Invoices can be recorded once the tender is contracted." });
    const { id } = await deliveredTender();
    expect((await addInvoice(db, { companyId: a, userId: user, tenderId: id, form: { invoiceNo: "I-1", invoiceDate: "2027-02-01", amount: "100" } })).ok).toBe(true);
  });

  it("rejects a missing number, a bad date or amount, and a repeated number", async () => {
    const { id } = await deliveredTender();
    const add = (over: Partial<{ invoiceNo: string; invoiceDate: string; amount: string }>) => addInvoice(db, { companyId: a, userId: user, tenderId: id, form: { invoiceNo: "I-9", invoiceDate: "2027-02-01", amount: "250", ...over } });
    expect((await add({ invoiceNo: " " })).ok).toBe(false);
    expect((await add({ invoiceDate: "1/2/2027" })).ok).toBe(false);
    expect((await add({ amount: "0" })).ok).toBe(false);
    expect((await add({})).ok).toBe(true);
    expect(await add({})).toEqual({ ok: false, error: "This invoice number is already recorded for this tender." });
  });

  it("stores a due date typed on the invoice, refuses a bad one, and lets finance change or clear it later", async () => {
    const { id } = await deliveredTender();
    const add = (invoiceNo: string, dueDate?: string) => addInvoice(db, { companyId: a, userId: user, tenderId: id, form: { invoiceNo, invoiceDate: "2027-02-01", amount: "100", dueDate } });
    expect((await add("D-1", "2027-03-15")).ok).toBe(true);
    expect((await add("D-2", "2027-01-31"))).toEqual({ ok: false, error: "The due date cannot be before the invoice date." });
    expect((await add("D-3", "next week"))).toEqual({ ok: false, error: "The due date is not a valid date." });
    expect((await add("D-4")).ok).toBe(true); // no due date: the tender's terms decide
    const rows = await listInvoices(db, a, id);
    expect(rows.map((r) => [r.invoiceNo, r.dueDate])).toEqual([["D-1", "2027-03-15"], ["D-4", null]]);
    const d1 = rows[0]!.id;
    const save = (over: Partial<Parameters<typeof setCollected>[1]>) => setCollected(db, { companyId: a, tenderId: id, invoiceId: d1, collected: "0", collectedOn: "", ...over });
    expect((await save({})).ok).toBe(true); // dueDate not posted: unchanged
    expect((await listInvoices(db, a, id))[0]!.dueDate).toBe("2027-03-15");
    expect((await save({ dueDate: "2027-04-01" })).ok).toBe(true);
    expect((await listInvoices(db, a, id))[0]!.dueDate).toBe("2027-04-01");
    expect((await save({ dueDate: "2027-01-01" })).ok).toBe(false);
    expect((await save({ dueDate: "" })).ok).toBe(true); // empty clears it
    expect((await listInvoices(db, a, id))[0]!.dueDate).toBeNull();
  });

  it("keeps collected between zero and the invoice amount and asks for the payment date", async () => {
    const { id } = await deliveredTender();
    const inv = await addInvoice(db, { companyId: a, userId: user, tenderId: id, form: { invoiceNo: "I-2", invoiceDate: "2027-02-01", amount: "1,000" } });
    if (!inv.ok) throw new Error(inv.error);
    const set = (collected: string, collectedOn: string) => setCollected(db, { companyId: a, tenderId: id, invoiceId: inv.id, collected, collectedOn });
    expect((await set("1,000.001", "2027-03-01")).ok).toBe(false);
    expect((await set("400", "")).ok).toBe(false);
    expect((await set("400", "2027-03-01")).ok).toBe(true);
    expect((await listInvoices(db, a, id))[0]).toMatchObject({ amount: 1000, collected: 400, lastCollectedOn: "2027-03-01" });
    expect((await set("0", "")).ok).toBe(true);
    expect((await listInvoices(db, a, id))[0]).toMatchObject({ collected: 0, lastCollectedOn: null });
    expect((await setCollected(db, { companyId: b, tenderId: id, invoiceId: inv.id, collected: "10", collectedOn: "2027-03-01" })).ok).toBe(false);
  });

  it("blocks Collected until there is an invoice and it is paid in full", async () => {
    const { id, full } = await deliveredTender();
    const toCollected = () => moveTender(db, { companyId: a, userId: user, role: "finance", tenderId: id, to: "collected", seenStatus: "delivered", form: full, note: "" });
    expect(await toCollected()).toEqual({ ok: false, error: "Before moving to Collected, record at least one invoice." });
    const inv = await addInvoice(db, { companyId: a, userId: user, tenderId: id, form: { invoiceNo: "I-3", invoiceDate: "2027-02-01", amount: "900" } });
    if (!inv.ok) throw new Error(inv.error);
    await setCollected(db, { companyId: a, tenderId: id, invoiceId: inv.id, collected: "500.5", collectedOn: "2027-03-01" });
    expect(await toCollected()).toEqual({ ok: false, error: "Before moving to Collected, collect the remaining JOD 399.500 on the invoices." });
    await setCollected(db, { companyId: a, tenderId: id, invoiceId: inv.id, collected: "900", collectedOn: "2027-03-10" });
    expect((await toCollected()).ok).toBe(true);
  });

  it("will not remove an invoice from a collected tender", async () => {
    const { id, full } = await deliveredTender();
    const inv = await addInvoice(db, { companyId: a, userId: user, tenderId: id, form: { invoiceNo: "I-4", invoiceDate: "2027-02-01", amount: "10" } });
    if (!inv.ok) throw new Error(inv.error);
    await setCollected(db, { companyId: a, tenderId: id, invoiceId: inv.id, collected: "10", collectedOn: "2027-03-10" });
    await moveTender(db, { companyId: a, userId: user, role: "finance", tenderId: id, to: "collected", seenStatus: "delivered", form: full, note: "" });
    expect(await deleteInvoice(db, { companyId: a, tenderId: id, invoiceId: inv.id })).toEqual({ ok: false, error: "Step the tender back from Collected before removing an invoice." });
    await moveTender(db, { companyId: a, userId: user, role: "finance", tenderId: id, to: "delivered", seenStatus: "collected", form: full, note: "" });
    expect((await deleteInvoice(db, { companyId: b, tenderId: id, invoiceId: inv.id })).ok).toBe(false);
    expect((await deleteInvoice(db, { companyId: a, tenderId: id, invoiceId: inv.id })).ok).toBe(true);
    expect(await listInvoices(db, a, id)).toEqual([]);
  });
});

describe("ERP check by invoice number", () => {
  const erpInvoice = async (company: string, customer: string, no: string) =>
    (await q<{ id: string }>(`insert into invoices (company_id, invoice_no, customer_id, invoice_date) values ('${company}', '${no}', '${customer}', '2027-02-01') returning id`))[0]!.id;

  it("reports unknown numbers as absent and no snapshot as a null date", async () => {
    expect((await erpFactsByInvoiceNo(db, a, [])).size).toBe(0);
    expect((await erpFactsByInvoiceNo(db, a, ["NOPE-1"])).size).toBe(0);
    const cust = (await q<{ id: string }>(`insert into customers (company_id, code, name) values ('${a}', 'CE0', 'Early') returning id`))[0]!.id;
    await erpInvoice(a, cust, "E-0");
    expect((await erpFactsByInvoiceNo(db, a, ["E-0"])).get("E-0")).toEqual({ found: true, snapshotDate: null, remaining: null });
  });

  it("reads what the newest unpaid file lists, ignores older files and other companies", async () => {
    const cust = (await q<{ id: string }>(`insert into customers (company_id, code, name) values ('${a}', 'CE1', 'Hospital') returning id`))[0]!.id;
    const custB = (await q<{ id: string }>(`insert into customers (company_id, code, name) values ('${b}', 'CE1', 'Other') returning id`))[0]!.id;
    const open = await erpInvoice(a, cust, "E-1");
    await erpInvoice(a, cust, "E-2");
    await erpInvoice(b, custB, "E-1");
    await client.query(`insert into open_invoice_snapshots (company_id, snapshot_date, invoice_id, remaining_amount) values ('${a}', '2027-03-01', '${open}', 900), ('${a}', '2027-04-01', '${open}', 250)`);
    const facts = await erpFactsByInvoiceNo(db, a, ["E-1", "E-2", "NOPE-1"]);
    expect(facts.get("E-1")).toEqual({ found: true, snapshotDate: "2027-04-01", remaining: 250 });
    expect(facts.get("E-2")).toEqual({ found: true, snapshotDate: "2027-04-01", remaining: null });
    expect(facts.has("NOPE-1")).toBe(false);
    expect((await erpFactsByInvoiceNo(db, b, ["E-1"])).get("E-1")).toEqual({ found: true, snapshotDate: null, remaining: null });
  });
});
