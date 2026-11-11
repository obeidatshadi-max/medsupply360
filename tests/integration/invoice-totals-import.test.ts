/**
 * Invoice totals against a real Postgres engine (PGlite) with the project migrations: one line per invoice with no
 * product, customers matched by code or by name, a missing customer added by name, and no invoice counted twice when
 * the line-by-line sales file arrives for it.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { runImport, type Db, type ImportOutcome, type RunImportInput } from "@/db/import-writer";
import type { ImportKind } from "@/core/import/specs";
import { UNSPLIT } from "@/core/sales-by-line";
import { companyAccounts } from "@/lib/company-accounts";
import { companySalesByLine } from "@/lib/sales-by-line";

// The screen readers take the database from the request; here they get the test engine.
const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db/client", () => ({ getDb: () => h.db }));
vi.mock("server-only", () => ({}));

let client: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
let a: string;
let b: string;

const TODAY = "2026-11-11";
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await client.query<T>(sql, params)).rows;
const imp = (company: string, kind: ImportKind, text: string, extra: Partial<RunImportInput> = {}): Promise<ImportOutcome> =>
  runImport(db as unknown as Db, { companyId: company, userId: null, kind, fileName: `${kind}.csv`, text, today: TODAY, dryRun: false, ...extra });
const count = async (table: string, company: string) => Number((await q<{ n: string }>(`select count(*) n from ${table} where company_id = $1`, [company]))[0]!.n);
const sales = async (company: string) => Number((await q<{ s: string }>(`select coalesce(sum(net_sales), 0) s from sales_lines where company_id = $1`, [company]))[0]!.s);
const summary = (out: ImportOutcome, label: string) => out.summary.find((l) => l.label === label)?.value;

// The headings of the "sales invoices" report as an Arabic ERP prints them.
const HEAD = "رقم الوثيقة,التاريخ,نوع الوثيقة,اسم العميل,القيمة قبل الضريبة,الضريبة,صافي الفاتورة";

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client, { schema });
  h.db = db;
  const dir = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(dir + f, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) await client.exec(stmt);
  }
  a = (await q<{ id: string }>(`insert into companies (slug, name) values ('a', 'A') returning id`))[0]!.id;
  b = (await q<{ id: string }>(`insert into companies (slug, name) values ('b', 'B') returning id`))[0]!.id;
  await imp(a, "products", "code,name,category\nP1,Gloves,Consumables");
  await imp(a, "customers", "code,name\nC1,Amal Hospital\nC7,Twin Clinic\nC8,Twin Clinic");
}, 60_000);
afterAll(async () => client.close());

describe("invoice totals import", () => {
  const FILE = [HEAD, "1001,05/11/2026,مبيعات,Amal Hospital,3965.517,634.483,4600.000", "1002,06/11/2026,مبيعات,مستشفى الجديد,100,16,116", "1003,07/11/2026,مردودات,مستشفى الجديد,20,3.2,23.2"].join("\n");

  it("a check saves nothing and says which customers would be added", async () => {
    const out = await imp(a, "invoice_totals", FILE, { dryRun: true });
    expect(out).toMatchObject({ state: "done", wrote: false, rowsAccepted: 3, rowsRejected: 0 });
    expect(summary(out, "Customers added by name (not in the customer list)")).toBe("1");
    expect(summary(out, "Sales before tax, after returns")).toBe("4,045.517 JOD");
    expect(await count("invoices", a)).toBe(0);
    expect(await count("customers", a)).toBe(3);
  });

  it("loads one line per invoice with no product, matches a customer by name and adds the missing one", async () => {
    const out = await imp(a, "invoice_totals", FILE);
    expect(out).toMatchObject({ state: "done", wrote: true, status: "accepted", rowsAccepted: 3 });
    expect(await count("invoices", a)).toBe(3);
    const lines = await q<{ line_no: string; product_id: string | null; quantity: string; net_sales: string; doc_type: string }>(
      `select s.line_no, s.product_id, s.quantity, s.net_sales, s.doc_type from sales_lines s join invoices i on i.id = s.invoice_id where s.company_id = $1 order by i.invoice_no`,
      [a],
    );
    expect(lines).toEqual([
      { line_no: "TOTAL", product_id: null, quantity: "0.000", net_sales: "3965.517", doc_type: "invoice" },
      { line_no: "TOTAL", product_id: null, quantity: "0.000", net_sales: "100.000", doc_type: "invoice" },
      { line_no: "TOTAL", product_id: null, quantity: "0.000", net_sales: "-20.000", doc_type: "return" },
    ]);
    // 1001 went to the existing customer C1 by its name; the unknown name became one new customer for both its invoices.
    const who = await q<{ invoice_no: string; code: string; name: string }>(`select i.invoice_no, c.code, c.name from invoices i join customers c on c.id = i.customer_id where i.company_id = $1 order by i.invoice_no`, [a]);
    expect(who[0]).toMatchObject({ invoice_no: "1001", code: "C1" });
    expect(who[1]!.code).toMatch(/^NAME-[0-9A-F]{12}$/);
    expect(who[1]!.name).toBe("مستشفى الجديد");
    expect(who[2]!.code).toBe(who[1]!.code);
    expect(await count("customers", a)).toBe(4);
    expect(await count("customers", b)).toBe(0);
  });

  it("a corrected file updates the amount instead of adding a second line", async () => {
    await imp(a, "invoice_totals", [HEAD, "1002,06/11/2026,مبيعات,مستشفى الجديد,150,24,174"].join("\n"));
    expect(await count("sales_lines", a)).toBe(3);
    expect(await sales(a)).toBeCloseTo(3965.517 + 150 - 20, 3);
    expect(await count("customers", a)).toBe(4);
  });

  it("rejects a name that two customers share, and an unknown customer code", async () => {
    const out = await imp(a, "invoice_totals", ["invoice no,date,customer code,customer name,amount before tax", "2001,01/11/2026,,Twin Clinic,10", "2002,01/11/2026,C99,Someone,10", "2003,01/11/2026,C7,Twin Clinic,10"].join("\n"));
    expect(out.rowsAccepted).toBe(1);
    expect(out.rejections.map((r) => r.reason)).toEqual([
      `customer name "Twin Clinic" is used by more than one customer: add the customer code to the file`,
      `unknown customer code "C99": import the customer list first`,
    ]);
  });

  it("the line-by-line sales file replaces the total, so the invoice is not counted twice", async () => {
    const before = await sales(a);
    await imp(a, "sales", "invoice no,line no,date,customer code,product code,qty,net sales\n1001,1,2026-11-05,C1,P1,10,3000\n1001,2,2026-11-05,C1,P1,5,965.517");
    const lines = await q<{ line_no: string }>(`select s.line_no from sales_lines s join invoices i on i.id = s.invoice_id where i.company_id = $1 and i.invoice_no = '1001' order by s.line_no`, [a]);
    expect(lines.map((l) => l.line_no)).toEqual(["1", "2"]);
    expect(await sales(a)).toBeCloseTo(before, 3);
  });

  it("an invoice already loaded line by line is left alone by a later totals file", async () => {
    const out = await imp(a, "invoice_totals", [HEAD, "1001,05/11/2026,مبيعات,Amal Hospital,9999,0,9999"].join("\n"));
    expect(out).toMatchObject({ status: "rejected", rowsAccepted: 0 });
    expect(out.rejections[0]!.reason).toBe("invoice 1001 is already loaded line by line from the sales file: left unchanged");
    const [row] = await q<{ n: string }>(`select count(*) n from sales_lines s join invoices i on i.id = s.invoice_id where i.company_id = $1 and i.invoice_no = '1001' and s.product_id is null`, [a]);
    expect(Number(row!.n)).toBe(0);
  });

  it("shows on the screens: sales by customer, and its own row beside the product lines", async () => {
    // Company b has only invoice totals: one customer known by name, a sale and a return.
    await imp(b, "invoice_totals", [HEAD, "9001,02/11/2026,مبيعات,Noor Clinic,200,32,232", "9002,03/11/2026,مردودات,Noor Clinic,50,8,58"].join("\n"));
    const accounts = await companyAccounts(b, TODAY);
    expect(accounts.rows).toHaveLength(1);
    expect(accounts.rows[0]).toMatchObject({ name: "Noor Clinic", sales: 150, lastOrder: "2026-11-02" });
    // A product line was chosen: an invoice with no product belongs to none of them.
    expect((await companyAccounts(b, TODAY, "all", "", TODAY, "Consumables")).rows[0]!.sales).toBe(0);
    const byLine = await companySalesByLine(b, TODAY);
    expect(byLine.total.sales).toBe(150);
    expect(byLine.lines.find((l) => l.line === UNSPLIT)).toMatchObject({ sales: 150, costCoverage: 0 });
    expect(byLine.lines.filter((l) => l.line !== UNSPLIT).every((l) => l.sales === 0)).toBe(true);
  });
});
