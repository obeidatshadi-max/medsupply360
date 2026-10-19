/**
 * The sales force against a real Postgres engine (PGlite) with the real migrations: the CEO's list of people, assigning
 * tenders, products (one at a time or a whole supplier) and customer accounts to them, the rules for turned-off people,
 * sales on a person's accounts, and company isolation.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import type { Db } from "@/db/import-writer";
import type { SalesPersonForm } from "@/core/sales-force";
import {
  addSalesPerson,
  assignAccount,
  assignProduct,
  assignSupplierProducts,
  assignTenderOwner,
  getSalesPerson,
  listPersonAccounts,
  listPersonProducts,
  listProductsForAssignment,
  listSalesPeople,
  listUnassignedAccounts,
  salesByPerson,
  salesByPersonProducts,
  setSalesPersonActive,
  updateSalesPerson,
} from "@/server/services/sales-force";
import { createTender, getTender, listTenders, type TenderForm } from "@/server/services/tenders";

let client: PGlite;
let db: Db;
let a: string;
let b: string;
let user: string;
const q = async <T>(sql: string) => (await client.query<T>(sql)).rows;

const tenderForm: TenderForm = { authority: "MOH", tenderNo: "", title: "Analyzer for central lab", productLine: "equipment", estimatedValue: "", deadline: "", bidValue: "", awardAmount: "", closeReason: "", contractNo: "", contractValue: "", deliveredOn: "", notes: "" };
const form = (over: Partial<SalesPersonForm> = {}): SalesPersonForm => ({ name: "Khaled Mansour", email: "", suppliers: [], monthlySalesTarget: "", newAccountsTarget: "", visitsPerWeek: "", ...over });

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client, { schema }) as unknown as Db;
  const dir = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(dir + f, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) await client.exec(stmt);
  }
  a = (await q<{ id: string }>(`insert into companies (slug, name) values ('a', 'A') returning id`))[0]!.id;
  b = (await q<{ id: string }>(`insert into companies (slug, name) values ('b', 'B') returning id`))[0]!.id;
  user = (await q<{ id: string }>(`insert into users (company_id, email, password_hash, full_name, role) values ('${a}', 'c@a.test', 'x', 'CEO', 'owner') returning id`))[0]!.id;
}, 60_000);
afterAll(async () => client.close());

const add = async (company: string, over: Partial<SalesPersonForm> = {}) => {
  const r = await addSalesPerson(db, { companyId: company, form: form(over) });
  if (!r.ok) throw new Error(r.error);
  return r.id;
};
const newTender = async (title: string) => {
  const r = await createTender(db, { companyId: a, userId: user, form: { ...tenderForm, title }, startAs: "pipeline" });
  if (!r.ok) throw new Error(r.error);
  return r.id;
};
const product = async (company: string, code: string, supplier: string | null) =>
  (await q<{ id: string }>(`insert into products (company_id, code, name, line, supplier_name) values ('${company}', '${code}', 'Product ${code}', 'Consumables', ${supplier ? `'${supplier}'` : "null"}) returning id`))[0]!.id;
const customer = async (company: string, code: string) => (await q<{ id: string }>(`insert into customers (company_id, code, name) values ('${company}', '${code}', 'Customer ${code}') returning id`))[0]!.id;

describe("sales force people", () => {
  it("keeps one list per company, refuses a duplicate name in any letter case, and stores the profile", async () => {
    const id = await add(a, { email: "Khaled@Example.com", suppliers: ["MEDIMA", "BOWA"], monthlySalesTarget: "25000", newAccountsTarget: "2", visitsPerWeek: "12" });
    expect(await addSalesPerson(db, { companyId: a, form: form({ name: "khaled  mansour" }) })).toEqual({ ok: false, error: "This name is already in the sales force." });
    expect((await addSalesPerson(db, { companyId: a, form: form({ name: "K" }) })).ok).toBe(false);
    await add(b);
    expect(await getSalesPerson(db, a, id)).toMatchObject({ name: "Khaled Mansour", email: "khaled@example.com", supplierNames: ["MEDIMA", "BOWA"], monthlySalesTarget: 25000, newAccountsTarget: 2, visitsPerWeek: 12, active: true });
    expect((await listSalesPeople(db, b)).map((p) => p.name)).toEqual(["Khaled Mansour"]);
    expect(await getSalesPerson(db, b, id)).toBeNull();
  });

  it("updates a person and refuses a name that another person already has", async () => {
    const id = (await listSalesPeople(db, a))[0]!.id;
    const other = await add(a, { name: "Dina Abu-Zaid" });
    expect((await updateSalesPerson(db, { companyId: a, id, form: form({ monthlySalesTarget: "30000", suppliers: ["MEDIMA"] }) })).ok).toBe(true);
    expect(await getSalesPerson(db, a, id)).toMatchObject({ monthlySalesTarget: 30000, supplierNames: ["MEDIMA"] });
    expect((await updateSalesPerson(db, { companyId: a, id: other, form: form({ name: "Khaled Mansour" }) })).ok).toBe(false);
    expect((await updateSalesPerson(db, { companyId: b, id, form: form() })).ok).toBe(false);
  });
});

describe("assigning work", () => {
  it("assigns a tender owner, shows the name, and counts it on the person", async () => {
    const person = (await listSalesPeople(db, a)).find((p) => p.name === "Khaled Mansour")!.id;
    const t = await newTender("Tender with owner");
    expect((await getTender(db, a, t))!.tender.ownerName).toBeNull();
    expect(await assignTenderOwner(db, { companyId: a, tenderId: t, ownerId: person })).toEqual({ ok: true, id: t });
    expect((await getTender(db, a, t))!.tender.ownerName).toBe("Khaled Mansour");
    expect((await listTenders(db, a)).find((x) => x.id === t)!.ownerId).toBe(person);
    expect((await getSalesPerson(db, a, person))!.tenders).toBe(1);
    expect(await assignTenderOwner(db, { companyId: a, tenderId: t, ownerId: null })).toEqual({ ok: true, id: t });
  });

  it("assigns one product, then a whole supplier, and reads them back", async () => {
    const khaled = (await listSalesPeople(db, a)).find((p) => p.name === "Khaled Mansour")!.id;
    const dina = (await listSalesPeople(db, a)).find((p) => p.name === "Dina Abu-Zaid")!.id;
    const p1 = await product(a, "P1", "MEDIMA");
    await product(a, "P2", "MEDIMA");
    const p3 = await product(a, "P3", "BOWA");
    expect(await assignProduct(db, { companyId: a, productId: p1, personId: khaled })).toEqual({ ok: true, id: p1 });
    expect(await assignSupplierProducts(db, { companyId: a, supplierName: "MEDIMA", personId: dina })).toEqual({ ok: true, count: 2 });
    const rows = await listProductsForAssignment(db, a);
    expect(rows.filter((r) => r.supplierName === "MEDIMA").every((r) => r.salesPersonName === "Dina Abu-Zaid")).toBe(true);
    expect(rows.find((r) => r.id === p3)!.salesPersonId).toBeNull();
    expect((await listPersonProducts(db, a, dina)).map((r) => r.code)).toEqual(["P1", "P2"]);
    expect((await getSalesPerson(db, a, dina))!.products).toBe(2);
    expect(await assignSupplierProducts(db, { companyId: a, supplierName: "MEDIMA", personId: null })).toEqual({ ok: true, count: 2 });
    expect((await assignSupplierProducts(db, { companyId: a, supplierName: "  ", personId: null })).ok).toBe(false);
  });

  it("assigns accounts and totals the sales on them", async () => {
    const dina = (await listSalesPeople(db, a)).find((p) => p.name === "Dina Abu-Zaid")!.id;
    const c1 = await customer(a, "C1");
    const c2 = await customer(a, "C2");
    const prod = await product(a, "P9", "X");
    expect((await listUnassignedAccounts(db, a, "C1")).map((c) => c.code)).toEqual(["C1"]);
    expect((await assignAccount(db, { companyId: a, customerId: c1, personId: dina })).ok).toBe(true);
    expect((await listUnassignedAccounts(db, a, "")).map((c) => c.code)).toEqual(["C2"]);
    expect((await listPersonAccounts(db, a, dina)).map((c) => c.code)).toEqual(["C1"]);
    const inv1 = (await q<{ id: string }>(`insert into invoices (company_id, invoice_no, customer_id, invoice_date) values ('${a}', 'I1', '${c1}', '2031-02-10') returning id`))[0]!.id;
    const inv2 = (await q<{ id: string }>(`insert into invoices (company_id, invoice_no, customer_id, invoice_date) values ('${a}', 'I2', '${c2}', '2031-02-11') returning id`))[0]!.id;
    await client.query(`insert into sales_lines (company_id, invoice_id, line_no, product_id, quantity, net_sales) values ('${a}', '${inv1}', '1', '${prod}', 1, 1500), ('${a}', '${inv1}', '2', '${prod}', 1, -200), ('${a}', '${inv2}', '1', '${prod}', 1, 999)`);
    const sales = await salesByPerson(db, a, "2031-01-01", "2031-12-31");
    expect(sales.get(dina)).toBe(1300);
    expect(sales.size).toBe(1);
    expect((await salesByPerson(db, a, "2032-01-01", "2032-12-31")).size).toBe(0);
  });

  it("totals the sales of the products a person holds, whoever bought them, and follows reassignment", async () => {
    const people = await listSalesPeople(db, a);
    const dina = people.find((p) => p.name === "Dina Abu-Zaid")!.id;
    const khaled = people.find((p) => p.name === "Khaled Mansour")!.id;
    const prod = (await q<{ id: string }>(`select id from products where company_id = '${a}' and code = 'P9'`))[0]!.id;
    expect((await assignProduct(db, { companyId: a, productId: prod, personId: dina })).ok).toBe(true);
    // P9 sold 1500 - 200 on C1 (Dina's account) and 999 on C2 (nobody's account): 2299 on the product view only.
    const byProduct = await salesByPersonProducts(db, a, "2031-01-01", "2031-12-31");
    expect(byProduct.get(dina)).toBe(2299);
    expect(byProduct.size).toBe(1);
    await assignProduct(db, { companyId: a, productId: prod, personId: khaled });
    const moved = await salesByPersonProducts(db, a, "2031-01-01", "2031-12-31");
    expect(moved.get(khaled)).toBe(2299);
    expect(moved.has(dina)).toBe(false);
    expect((await salesByPersonProducts(db, a, "2032-01-01", "2032-12-31")).size).toBe(0);
    await assignProduct(db, { companyId: a, productId: prod, personId: null });
  });
});

describe("rules and isolation", () => {
  it("never lets work go to another company's person or a made-up id", async () => {
    const other = (await listSalesPeople(db, b))[0]!.id;
    const t = await newTender("Tender isolation");
    const c = await customer(a, "C7");
    const p = await product(a, "P7", "Z");
    for (const personId of [other, "nope"]) {
      expect((await assignTenderOwner(db, { companyId: a, tenderId: t, ownerId: personId })).ok).toBe(false);
      expect((await assignAccount(db, { companyId: a, customerId: c, personId })).ok).toBe(false);
      expect((await assignProduct(db, { companyId: a, productId: p, personId })).ok).toBe(false);
    }
    expect((await assignTenderOwner(db, { companyId: b, tenderId: t, ownerId: other })).ok).toBe(false);
    expect((await setSalesPersonActive(db, { companyId: b, id: (await listSalesPeople(db, a))[0]!.id, active: false })).ok).toBe(false);
  });

  it("keeps a turned-off person on what they hold but blocks giving them anything new", async () => {
    const khaled = (await listSalesPeople(db, a)).find((p) => p.name === "Khaled Mansour")!.id;
    const held = await newTender("Tender held");
    const fresh = await newTender("Tender fresh");
    await assignTenderOwner(db, { companyId: a, tenderId: held, ownerId: khaled });
    expect((await setSalesPersonActive(db, { companyId: a, id: khaled, active: false })).ok).toBe(true);
    expect((await getTender(db, a, held))!.tender.ownerName).toBe("Khaled Mansour");
    expect((await assignTenderOwner(db, { companyId: a, tenderId: held, ownerId: khaled })).ok).toBe(true);
    expect((await assignTenderOwner(db, { companyId: a, tenderId: fresh, ownerId: khaled })).ok).toBe(false);
    expect((await assignSupplierProducts(db, { companyId: a, supplierName: "BOWA", personId: khaled })).ok).toBe(false);
  });
});
