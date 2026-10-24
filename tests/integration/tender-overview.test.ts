/**
 * The owner's tender overview against a real Postgres engine (PGlite) with the real migrations: figures come from the
 * stored tenders, guarantees and invoices, and never mix companies.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import type { Db } from "@/db/import-writer";
import { companyTenderOverview } from "@/server/services/tender-overview";

let client: PGlite;
let db: Db;
let a: string;
let b: string;
let openTender: string;
const q = async <T>(sql: string) => (await client.query<T>(sql)).rows;
const TODAY = "2026-10-18";

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client, { schema }) as unknown as Db;
  const dir = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(dir + f, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) await client.exec(stmt);
  }
  a = (await q<{ id: string }>(`insert into companies (slug, name) values ('a', 'A') returning id`))[0]!.id;
  b = (await q<{ id: string }>(`insert into companies (slug, name) values ('b', 'B') returning id`))[0]!.id;
  const tender = async (company: string, authority: string, title: string, status: string, extra = "") =>
    (await q<{ id: string }>(`insert into tenders (company_id, authority, title, product_line, status${extra ? ", " + extra.split("|")[0] : ""}) values ('${company}', '${authority}', '${title}', 'equipment', '${status}'${extra ? ", " + extra.split("|")[1] : ""}) returning id`))[0]!.id;
  const open = await tender(a, "MOH", "Open one", "preparing", "estimated_value, deadline|20000, '2026-10-25'");
  const won = await tender(a, "KHCC", "Won one", "delivered", "contract_value, award_amount|9000, 9000");
  await tender(a, "JUH", "Lost one", "lost", "close_reason|'Price too high'");
  await tender(b, "MOH", "Other company", "preparing", "estimated_value|999999");
  await client.exec(`insert into tender_guarantees (company_id, tender_id, kind, amount, expires_on) values ('${a}', '${open}', 'bid', 1500, '2026-11-15')`);
  openTender = open;
  await client.exec(`insert into tender_invoices (company_id, tender_id, invoice_no, invoice_date, amount, collected_amount) values ('${a}', '${won}', 'I-1', '2027-01-01', 9000, 2500)`);
}, 60_000);
afterAll(async () => client.close());

describe("companyTenderOverview", () => {
  it("summarises one company's tenders, guarantees and invoices", async () => {
    const o = await companyTenderOverview(db, a, TODAY);
    expect(o.total).toBe(3);
    expect(o.phases.find((p) => p.key === "before_bidding")).toMatchObject({ count: 1, value: 20000 });
    expect(o.phases.find((p) => p.key === "delivery_payment")).toMatchObject({ count: 1, value: 9000 });
    expect(o.phases.find((p) => p.key === "closed")).toMatchObject({ count: 1 });
    expect(o.results).toMatchObject({ won: 1, lost: 1, winRate: 0.5, wonValue: 9000 });
    expect(o.results.recentLost[0]).toMatchObject({ title: "Lost one", reason: "Price too high" });
    expect(o.deadlines.upcoming).toMatchObject([{ title: "Open one", daysLeft: 7 }]);
    expect(o.guarantees).toMatchObject({ active: 1500, count: 1 });
    expect(o.payments).toEqual({ invoiced: 9000, collected: 2500, unpaid: 6500 });
    expect(o.authorities.find((x) => x.code === "KHCC")!.unpaid).toBe(6500);
  });

  it("does not let a guarantee in one company point at another company's tender", async () => {
    await expect(client.exec(`insert into tender_guarantees (company_id, tender_id, kind, amount, expires_on) values ('${b}', '${openTender}', 'bid', 777, '2026-11-15')`)).rejects.toThrow();
  });

  it("never includes another company's rows", async () => {
    const o = await companyTenderOverview(db, b, TODAY);
    expect(o.total).toBe(1);
    expect(o.guarantees.count).toBe(0);
    expect(o.payments.invoiced).toBe(0);
    expect((await companyTenderOverview(db, "00000000-0000-0000-0000-000000000000", TODAY)).total).toBe(0);
  });
});

describe("time from submission to decision", () => {
  let c: string;
  beforeAll(async () => {
    c = (await q<{ id: string }>(`insert into companies (slug, name) values ('c', 'C') returning id`))[0]!.id;
    const t = async (authority: string, title: string, status: string, submittedOn?: string) =>
      (await q<{ id: string }>(`insert into tenders (company_id, authority, title, product_line, status${submittedOn ? ", submitted_on" : ""}) values ('${c}', '${authority}', '${title}', 'equipment', '${status}'${submittedOn ? `, '${submittedOn}'` : ""}) returning id`))[0]!.id;
    const log = (tender: string, to: string, at: string) =>
      client.exec(`insert into tender_status_log (company_id, tender_id, to_status, created_at) values ('${c}', '${tender}', '${to}', '${at}')`);
    // no typed date: the day it entered Submitted is used; 22:30 UTC is already the next day in Amman
    const lost = await t("MOH", "Lost, log dates only", "lost");
    await log(lost, "submitted", "2026-06-01T08:00:00Z");
    await log(lost, "lost", "2026-06-30T22:30:00Z");
    // a typed submission date wins over the day someone clicked Submitted
    const won = await t("KHCC", "Won, typed date", "contracted", "2026-06-10");
    await log(won, "submitted", "2026-06-05T08:00:00Z");
    await log(won, "won", "2026-06-20T08:00:00Z");
    await log(won, "contracted", "2026-07-20T08:00:00Z");
    // decided but never submitted in the log and no typed date: counted as missing, not as zero
    const nodate = await t("JUH", "Lost, no submission date", "lost");
    await log(nodate, "lost", "2026-06-15T08:00:00Z");
    // not decided: ignored
    const waiting = await t("DRMS", "Waiting", "submitted");
    await log(waiting, "submitted", "2026-09-01T08:00:00Z");
  });

  it("measures days from the submission date to the decision, in Jordan time, and says how many tenders it left out", async () => {
    const o = await companyTenderOverview(db, c, TODAY);
    expect(o.timeToDecision).toEqual({ count: 2, average: 20, median: 20, fastest: 10, slowest: 30, missing: 1 });
    expect(o.authorities.find((x) => x.code === "MOH")!.avgDaysToDecision).toBe(30);
    expect(o.authorities.find((x) => x.code === "KHCC")!.avgDaysToDecision).toBe(10);
    expect(o.authorities.find((x) => x.code === "JUH")!.avgDaysToDecision).toBeNull();
    expect(o.authorities.find((x) => x.code === "DRMS")!.avgDaysToDecision).toBeNull();
  });

  it("is empty for a company with no decided tender", async () => {
    expect((await companyTenderOverview(db, b, TODAY)).timeToDecision).toEqual({ count: 0, average: null, median: null, fastest: null, slowest: null, missing: 0 });
  });
});
