/**
 * The two hand-filled uploads of the Tender and Manual channels against a real Postgres engine (PGlite) with the
 * project's actual migrations: new rows are created, matches are updated, blanks never erase, and a tender is never
 * moved to another stage by a list.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { runImport, type Db, type ImportOutcome, type RunImportInput } from "@/db/import-writer";
import type { ImportKind } from "@/core/import/specs";

let client: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
let a: string;
let b: string;

const TODAY = "2026-10-20";
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await client.query<T>(sql, params)).rows;
const imp = (company: string, kind: ImportKind, text: string, extra: Partial<RunImportInput> = {}): Promise<ImportOutcome> =>
  runImport(db as unknown as Db, { companyId: company, userId: null, kind, fileName: `${kind}-${Math.random()}.csv`, text, today: TODAY, dryRun: false, ...extra });
const total = async (table: string, company?: string) =>
  Number((await q<{ n: string }>(company ? `select count(*) n from ${table} where company_id = $1` : `select count(*) n from ${table}`, company ? [company] : []))[0]!.n);

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client, { schema });
  const dir = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(dir + f, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) await client.exec(stmt);
  }
  a = (await q<{ id: string }>(`insert into companies (slug, name) values ('a', 'A') returning id`))[0]!.id;
  b = (await q<{ id: string }>(`insert into companies (slug, name) values ('b', 'B') returning id`))[0]!.id;
}, 60_000);
afterAll(async () => client.close());

const HEAD = "authority,tender no,title,product line,status,estimated value,deadline,bid value,award amount,reason";

describe("tender list", () => {
  it("creates tenders at the stage in the file, with a first entry in their status log", async () => {
    const out = await imp(a, "tenders", `${HEAD}\nMOH,MOH-1,Analyzer supply,equipment,open,50000,2026-12-01,,,\nKHCC,,Reagent contract,consumables,,,,,,`);
    expect(out).toMatchObject({ state: "done", status: "accepted", rowsAccepted: 2, wrote: true });
    const rows = await q<{ title: string; status: string; estimated_value: string | null }>(`select title, status, estimated_value from tenders where company_id = $1 order by title`, [a]);
    expect(rows).toEqual([
      { title: "Analyzer supply", status: "open", estimated_value: "50000.000" },
      { title: "Reagent contract", status: "pipeline", estimated_value: null },
    ]);
    const log = await q<{ from_status: string | null; to_status: string }>(`select from_status, to_status from tender_status_log where company_id = $1 order by to_status::text`, [a]);
    expect(log).toEqual([
      { from_status: null, to_status: "open" },
      { from_status: null, to_status: "pipeline" },
    ]);
    expect(out.summary.find((l) => l.label === "New tenders")?.value).toBe("2");
  });

  it("updates a tender it already has, keeps blanks, and warns instead of moving its stage", async () => {
    const out = await imp(a, "tenders", `${HEAD}\nMOH,MOH-1,Analyzer supply (rev 2),equipment,preparing,60000,,,,\nKHCC,,Reagent contract,consumables,,,2027-01-15,,,`);
    expect(out).toMatchObject({ status: "accepted", rowsAccepted: 2 });
    expect(out.warnings.map((w) => w.reason).join("|")).toMatch(/already recorded as Open.*not changed here/);
    const [moh] = await q<{ title: string; status: string; estimated_value: string; deadline: string }>(
      `select title, status, estimated_value, deadline::text from tenders where company_id = $1 and tender_no = 'MOH-1'`,
      [a],
    );
    expect(moh).toEqual({ title: "Analyzer supply (rev 2)", status: "open", estimated_value: "60000.000", deadline: "2026-12-01" });
    const [khcc] = await q<{ deadline: string }>(`select deadline::text from tenders where company_id = $1 and title = 'Reagent contract'`, [a]);
    expect(khcc!.deadline).toBe("2027-01-15");
    expect(await total("tenders", a)).toBe(2);
    expect(out.summary.find((l) => l.label.startsWith("Already recorded"))?.value).toBe("2");
  });

  it("rejects a tender missing what its stage needs, and an unknown authority", async () => {
    const out = await imp(a, "tenders", `${HEAD}\nJUH,JUH-9,Won without award,equipment,won,,,,,\nXYZ,,Unknown buyer,equipment,,,,,,`);
    expect(out.status).toBe("rejected");
    const reasons = out.rejections.map((r) => r.reason).join("|");
    expect(reasons).toMatch(/award amount/);
    expect(reasons).toMatch(/unrecognised authority/);
  });

  it("loads coded reasons, the winner and the expected award date; a free-text reason alone is stored as Other", async () => {
    const H = "authority,tender no,title,product line,status,bid value,reason code,reason note,winner,winning price,expected award date";
    const out = await imp(
      a,
      "tenders",
      [
        H,
        "KAUH,KAUH-L1,Lost on price,equipment,lost,900,price,Too high,Rival Co,820.500,",
        "KAUH,KAUH-L2,Lost in an old file style,equipment,lost,,,Spec was changed by the authority,,,",
        "KAUH,KAUH-C1,Withdrawn,equipment,cancelled,,no budget,,,,",
        "KAUH,KAUH-S1,Waiting,equipment,submitted,500,,,,,2027-02-01",
      ].join("\n"),
    );
    expect(out).toMatchObject({ status: "accepted", rowsAccepted: 4 });
    const rows = await q<{ tender_no: string; close_reason_code: string | null; close_reason: string | null; winner_name: string | null; winning_price: string | null; expected_award_date: string | null }>(
      `select tender_no, close_reason_code, close_reason, winner_name, winning_price, expected_award_date::text from tenders where company_id = $1 and authority = 'KAUH' order by tender_no`,
      [a],
    );
    expect(rows).toEqual([
      { tender_no: "KAUH-C1", close_reason_code: "no_budget", close_reason: null, winner_name: null, winning_price: null, expected_award_date: null },
      { tender_no: "KAUH-L1", close_reason_code: "price", close_reason: "Too high", winner_name: "Rival Co", winning_price: "820.500", expected_award_date: null },
      { tender_no: "KAUH-L2", close_reason_code: "other", close_reason: "Spec was changed by the authority", winner_name: null, winning_price: null, expected_award_date: null },
      { tender_no: "KAUH-S1", close_reason_code: null, close_reason: null, winner_name: null, winning_price: null, expected_award_date: "2027-02-01" },
    ]);
  });

  it("loads the date submitted and the bid opening date", async () => {
    const out = await imp(
      a,
      "tenders",
      ["authority,tender no,title,product line,status,bid value,date submitted,bid opening date", "KAUH,KAUH-D1,Dated bid,equipment,submitted,500,2026-10-01,03/10/2026"].join("\n"),
    );
    expect(out).toMatchObject({ status: "accepted", rowsAccepted: 1 });
    const [row] = await q<{ submitted_on: string; bid_opening_date: string }>(`select submitted_on::text, bid_opening_date::text from tenders where company_id = $1 and tender_no = 'KAUH-D1'`, [a]);
    expect(row).toEqual({ submitted_on: "2026-10-01", bid_opening_date: "2026-10-03" });
  });

  it("rejects a lost tender with no reason, and a reason that does not fit its ending", async () => {
    const H = "authority,tender no,title,product line,status,reason code";
    const out = await imp(a, "tenders", [H, "JUH,JUH-X1,No reason,equipment,lost,", "JUH,JUH-X2,Wrong reason,equipment,lost,no budget", "JUH,JUH-X3,Unknown reason,equipment,cancelled,because"].join("\n"));
    expect(out.status).toBe("rejected");
    const reasons = out.rejections.map((r) => r.reason).join("|");
    expect(reasons).toMatch(/reason it was lost/);
    expect(reasons).toMatch(/does not fit a tender that is lost/);
    expect(reasons).toMatch(/close reason code/);
  });

  it("previews without saving and keeps companies apart", async () => {
    const before = await total("tenders");
    const dry = await imp(b, "tenders", `${HEAD}\nDRMS,,Dry run tender,mixed,,,,,,`, { dryRun: true });
    expect(dry).toMatchObject({ dryRun: true, wrote: false, rowsAccepted: 1 });
    expect(await total("tenders")).toBe(before);
    await imp(b, "tenders", `${HEAD}\nMOH,MOH-1,Same number other company,equipment,,,,,,`);
    expect(await total("tenders", b)).toBe(1);
  });
});

describe("sales force and targets", () => {
  const PEOPLE = "name,email,suppliers,monthly sales target,new accounts,visits per week\nLayla Nasser,layla@example.com,Sysmex; Roche,20000,2,10\nOmar Saleh,,,15000,,";

  it("adds people with targets and suppliers", async () => {
    await q(`insert into products (company_id, code, name, line, supplier_name) values ($1, 'P1', 'Reagent', 'Consumables', 'Sysmex')`, [a]);
    const out = await imp(a, "sales_people", PEOPLE);
    expect(out).toMatchObject({ status: "accepted", rowsAccepted: 2, wrote: true });
    const [layla] = await q<{ supplier_names: string[]; monthly_sales_target: string; visits_per_week: number; active: boolean }>(
      `select supplier_names, monthly_sales_target, visits_per_week, active from sales_people where company_id = $1 and name = 'Layla Nasser'`,
      [a],
    );
    expect(layla).toEqual({ supplier_names: ["Sysmex", "Roche"], monthly_sales_target: "20000.000", visits_per_week: 10, active: true });
    // Roche is not a supplier in the product list yet.
    expect(out.warnings.map((w) => w.reason).join("|")).toMatch(/supplier "Roche" is not in the product list/);
  });

  it("updates by name without erasing what the new file leaves blank", async () => {
    const out = await imp(a, "sales_people", "name,monthly sales target\nlayla nasser,25000");
    expect(out.summary.find((l) => l.label.startsWith("Already recorded"))?.value).toBe("1");
    const [layla] = await q<{ supplier_names: string[]; monthly_sales_target: string; email: string }>(
      `select supplier_names, monthly_sales_target, email from sales_people where company_id = $1 and name = 'Layla Nasser'`,
      [a],
    );
    expect(layla).toEqual({ supplier_names: ["Sysmex", "Roche"], monthly_sales_target: "25000.000", email: "layla@example.com" });
    expect(await total("sales_people", a)).toBe(2);
  });

  it("rejects a bad email and a visits figure that is too high, and a name repeated in the file", async () => {
    const out = await imp(a, "sales_people", "name,email,visits per week\nSami,not-an-email,5\nRana Khoury,rana@example.com,500\nDina Haddad,,3\nDina Haddad,,4");
    expect(out.rowsAccepted).toBe(1);
    const reasons = out.rejections.map((r) => r.reason).join("|");
    expect(reasons).toMatch(/valid email/);
    expect(reasons).toMatch(/100 or less/);
    expect(out.rejections).toHaveLength(3);
  });
});
