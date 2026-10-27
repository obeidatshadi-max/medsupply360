/**
 * The unpaid-invoice file is checked against the sales already loaded: an invoice the sales never had, or an unpaid
 * amount above what the invoice was for, is loaded (cash is real) but flagged. Real Postgres engine (PGlite).
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { runImport, type Db } from "@/db/import-writer";

let client: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
let fresh: string;
let loaded: string;
const TODAY = "2026-10-20";
const csv = (...lines: string[]) => lines.join("\n");
const imp = (company: string, kind: Parameters<typeof runImport>[1]["kind"], text: string, dryRun = true) =>
  runImport(db as unknown as Db, { companyId: company, userId: null, kind, fileName: `${kind}-${Math.random()}.csv`, text, today: TODAY, snapshotDate: "2026-10-19", dryRun });

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client, { schema });
  const dir = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort())
    for (const stmt of readFileSync(dir + f, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) await client.exec(stmt);
  const mk = async (slug: string) => (await client.query<{ id: string }>(`insert into companies (slug, name) values ('${slug}', '${slug}') returning id`)).rows[0]!.id;
  fresh = await mk("fresh");
  loaded = await mk("loaded");
  for (const c of [fresh, loaded]) {
    await imp(c, "products", csv("code,name,category", "P1,Gloves,Consumables"), false);
    await imp(c, "customers", csv("code,name", "C1,Clinic"), false);
  }
  await imp(loaded, "sales", csv("invoice no,line no,date,customer code,product code,qty,net sales", "I1,1,2026-09-01,C1,P1,1,100", "I1,2,2026-09-01,C1,P1,1,50"), false);
}, 60_000);
afterAll(async () => client.close());

const HEAD = "invoice no,customer code,invoice date,remaining";

describe("unpaid invoices against sales", () => {
  it("is quiet when the unpaid amount is within the invoice", async () => {
    const out = await imp(loaded, "open_invoices", csv(HEAD, "I1,C1,2026-09-01,150"));
    expect(out).toMatchObject({ status: "accepted", rowsAccepted: 1, warnings: [] });
  });

  it("warns, but still loads, an amount above the invoice total", async () => {
    const out = await imp(loaded, "open_invoices", csv(HEAD, "I1,C1,2026-09-01,151"));
    expect(out.status).toBe("accepted");
    expect(out.warnings.map((w) => w.reason).join("|")).toMatch(/I1.*151\.000.*more than the invoice total.*150\.000/);
  });

  it("warns about an invoice the loaded sales never had", async () => {
    const out = await imp(loaded, "open_invoices", csv(HEAD, "I9,C1,2026-09-01,10"));
    expect(out.status).toBe("accepted");
    expect(out.warnings.map((w) => w.reason).join("|")).toMatch(/I9 is not in the sales loaded so far/);
  });

  it("says nothing when no sales were loaded yet (nothing to compare with)", async () => {
    const out = await imp(fresh, "open_invoices", csv(HEAD, "I9,C1,2026-09-01,10"));
    expect(out).toMatchObject({ status: "accepted", warnings: [] });
  });

  it("says nothing inside a multi-file check, where the sales file is not stored yet", async () => {
    const out = await runImport(db as unknown as Db, {
      companyId: loaded, userId: null, kind: "open_invoices", fileName: "x.csv", text: csv(HEAD, "I9,C1,2026-09-01,10"), today: TODAY, snapshotDate: "2026-10-19", dryRun: true,
      assumed: { customerCodes: [], productCodes: [] },
    });
    expect(out.warnings).toEqual([]);
  });
});
