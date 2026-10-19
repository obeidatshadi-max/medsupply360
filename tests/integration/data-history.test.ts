/**
 * The update history against a real Postgres engine (PGlite) with the real migrations: the typed name is stored with the
 * change, the newest change comes first, only data actions are listed, and one company never sees another's records.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import type { Db } from "@/db/import-writer";
import { listDataHistory } from "@/server/services/data-history";
import { createTender, getTender, moveTender, type TenderForm } from "@/server/services/tenders";

let client: PGlite;
let db: Db;
let a: string;
let b: string;
let account: string;
const q = async <T>(sql: string) => (await client.query<T>(sql)).rows;

const blank: TenderForm = { authority: "MOH", tenderNo: "", title: "Analyzer for central lab", productLine: "equipment", estimatedValue: "", deadline: "", bidValue: "", awardAmount: "", closeReason: "", contractNo: "", contractValue: "", deliveredOn: "", notes: "" };

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client, { schema }) as unknown as Db;
  const dir = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(dir + f, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) await client.exec(stmt);
  }
  a = (await q<{ id: string }>(`insert into companies (slug, name) values ('a', 'A') returning id`))[0]!.id;
  b = (await q<{ id: string }>(`insert into companies (slug, name) values ('b', 'B') returning id`))[0]!.id;
  account = (await q<{ id: string }>(`insert into users (company_id, email, password_hash, full_name, role) values ('${a}', 't@a.test', 'x', 'Tender Department', 'tender') returning id`))[0]!.id;
}, 60_000);
afterAll(async () => client.close());

const audit = (company: string, action: string, who: string | null, at: string, extra = "null") =>
  client.query(`insert into audit_logs (company_id, user_id, action, submitted_by, details, created_at) values ('${company}', ${company === a ? `'${account}'` : "null"}, '${action}', ${who ? `'${who}'` : "null"}, ${extra === "null" ? "null" : `'${extra}'::jsonb`}, '${at}')`);

describe("update history", () => {
  it("stores the typed name on the tender's status log next to the shared account", async () => {
    const r = await createTender(db, { companyId: a, userId: account, submittedBy: "Lina Haddad", form: blank, startAs: "pipeline" });
    if (!r.ok) throw new Error(r.error);
    const m = await moveTender(db, { companyId: a, userId: account, submittedBy: "Omar Saleh", role: "tender", tenderId: r.id, to: "open", seenStatus: "pipeline", form: { ...blank, tenderNo: "MOH-1", estimatedValue: "1000", deadline: "2030-01-01" }, note: "" });
    if (!m.ok) throw new Error(m.error);
    const { history } = (await getTender(db, a, r.id))!;
    expect(history.map((h) => [h.submittedBy, h.by])).toEqual([
      ["Lina Haddad", "Tender Department"],
      ["Omar Saleh", "Tender Department"],
    ]);
  });

  it("lists newest first, with the typed name and the account, and skips non-data actions", async () => {
    await audit(a, "tender.moved", "Omar Saleh", "2031-03-02T09:00:00Z", '{"from":"open","to":"preparing"}');
    await audit(a, "tender.created", "Lina Haddad", "2031-03-01T09:00:00Z");
    await audit(a, "auth.login", null, "2031-03-03T09:00:00Z");
    await audit(a, "tender.created", null, "2031-02-01T09:00:00Z");
    const rows = await listDataHistory(db, a);
    const mine = rows.filter((r) => r.at.getUTCFullYear() === 2031);
    expect(mine.map((r) => [r.submittedBy, r.text, r.account])).toEqual([
      ["Omar Saleh", "Moved a tender from Open to Preparing", "Tender Department"],
      ["Lina Haddad", "Recorded a new tender", "Tender Department"],
      [null, "Recorded a new tender", "Tender Department"],
    ]);
    expect(rows.every((r) => !r.text.toLowerCase().includes("login"))).toBe(true);
  });

  it("never shows another company's records", async () => {
    await audit(b, "tender.created", "Someone Else", "2031-04-01T09:00:00Z");
    expect((await listDataHistory(db, a)).some((r) => r.submittedBy === "Someone Else")).toBe(false);
    expect((await listDataHistory(db, b)).map((r) => r.submittedBy)).toEqual(["Someone Else"]);
  });

  it("links a guarantee or invoice change to its tender by title", async () => {
    const [t] = await q<{ id: string }>(`select id from tenders where company_id = '${a}' limit 1`);
    await audit(a, "tender.guarantee_added", "Finance Officer", "2031-05-01T09:00:00Z", JSON.stringify({ tenderId: t!.id, kind: "bid" }));
    const row = (await listDataHistory(db, a)).find((r) => r.submittedBy === "Finance Officer")!;
    expect(row.text).toBe("Added a bid guarantee");
    expect(row.tenderTitle).toBe("Analyzer for central lab");
    expect(row.tenderId).toBe(t!.id);
  });
});
