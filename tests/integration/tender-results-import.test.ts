/**
 * Tender results against a real Postgres engine (PGlite) with the project migrations: one row per bidder per item,
 * tenders and items created from the rows, product links, merging two files that describe the same bid, company isolation.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { runImport, type Db, type ImportOutcome, type RunImportInput } from "@/db/import-writer";
import type { ImportKind } from "@/core/import/specs";
import { prefillRows, rowsToCsv } from "@/core/tender-results-prefill";
import { archivedBidCount } from "@/server/services/tender-prices";

let client: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
let a: string;
let b: string;

const TODAY = "2026-10-24";
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await client.query<T>(sql, params)).rows;
const imp = (company: string, kind: ImportKind, text: string, extra: Partial<RunImportInput> = {}): Promise<ImportOutcome> =>
  runImport(db as unknown as Db, { companyId: company, userId: null, kind, fileName: `${kind}.csv`, text, today: TODAY, dryRun: false, ...extra });
const count = async (table: string, company: string) => Number((await q<{ n: string }>(`select count(*) n from ${table} where company_id = $1`, [company]))[0]!.n);

const HEAD = "authority,tender no,tender title,award date,item code,item,therapeutic area,quantity,bidder,our bid,unit price,result";

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client, { schema });
  const dir = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(dir + f, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) await client.exec(stmt);
  }
  a = (await q<{ id: string }>(`insert into companies (slug, name) values ('a', 'A') returning id`))[0]!.id;
  b = (await q<{ id: string }>(`insert into companies (slug, name) values ('b', 'B') returning id`))[0]!.id;
  await imp(a, "products", "code,name,category,therapeutic area\nGS-50,Glucose strips 50,Consumables,Diabetes");
}, 60_000);
afterAll(async () => client.close());

describe("tender results import", () => {
  it("creates the tender, the items and one bid per bidder, and links an item to a known product", async () => {
    const out = await imp(
      a,
      "tender_results",
      [
        HEAD,
        "MOH,MOH-2025-14,Diabetes supplies,2025-03-01,GS-50,Glucose strips 50,,500,Sadaf,yes,4.250,won",
        "MOH,MOH-2025-14,Diabetes supplies,2025-03-01,GS-50,Glucose strips 50,,500,Rival Co,no,4.400,lost",
        "MOH,MOH-2025-14,Diabetes supplies,2025-03-01,,Lancets,Diabetes,2000,Rival Co,no,0.080,won",
      ].join("\n"),
    );
    expect(out).toMatchObject({ state: "done", status: "accepted", rowsAccepted: 3, wrote: true });
    expect(await count("tender_archive", a)).toBe(1);
    expect(await count("tender_archive_lines", a)).toBe(2);
    expect(await count("tender_bids", a)).toBe(3);
    const [line] = await q<{ product_id: string | null; therapeutic_area: string | null }>(
      `select product_id, therapeutic_area from tender_archive_lines where company_id = $1 and item_code = 'GS-50'`,
      [a],
    );
    expect(line!.product_id).not.toBeNull();
    expect(line!.therapeutic_area).toBe("Diabetes"); // taken from the product, the file left it empty
  });

  it("keeps an item whose code is not in the product list, by name, and says so", async () => {
    const out = await imp(a, "tender_results", [HEAD, "KHCC,K-1,,2025-05-01,X-99,Syringe 5ml,,100,Rival Co,no,0.030,won"].join("\n"));
    expect(out).toMatchObject({ status: "accepted", rowsAccepted: 1 });
    expect(out.warnings[0]!.reason).toMatch(/X-99.*not in the product list/);
    const [line] = await q<{ product_id: string | null; item_name: string }>(`select product_id, item_name from tender_archive_lines where company_id = $1 and item_code = 'X-99'`, [a]);
    expect(line).toEqual({ product_id: null, item_name: "Syringe 5ml" });
  });

  it("merges a second file about the same bid without blanking what the first one knew", async () => {
    // Our own sheet knows our price and that the bid is ours; the award notice knows the result but not the price.
    await imp(a, "tender_results", [HEAD, "JUH,J-1,,2025-06-01,,Control solution,,10,Sadaf,yes,7.000,unknown"].join("\n"));
    await imp(a, "tender_results", [HEAD, "JUH,J-1,Control solutions,2025-06-01,,Control solution,,10,SADAF,no,,lost"].join("\n"));
    const rows = await q<{ bidder: string; is_own: boolean; unit_price: string | null; outcome: string }>(
      `select b.bidder, b.is_own, b.unit_price, b.outcome from tender_bids b join tender_archive_lines l on l.id = b.line_id where b.company_id = $1 and l.item_name = 'Control solution'`,
      [a],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ is_own: true, unit_price: "7.000", outcome: "lost" });
    const [t] = await q<{ title: string }>(`select title from tender_archive where company_id = $1 and tender_no = 'J-1'`, [a]);
    expect(t!.title).toBe("Control solutions");
  });

  it("links the archive entry to the live tender with the same authority and number", async () => {
    await q(`insert into tenders (company_id, authority, tender_no, title, product_line) values ($1, 'DRMS', 'D-5', 'Live one', 'consumables')`, [a]);
    await imp(a, "tender_results", [HEAD, "DRMS,D-5,,2025-07-01,,Gauze,,50,Rival Co,no,1.000,won"].join("\n"));
    const [row] = await q<{ linked: boolean }>(`select tender_id is not null as linked from tender_archive where company_id = $1 and tender_no = 'D-5'`, [a]);
    expect(row!.linked).toBe(true);
  });

  it("re-importing a corrected file updates the price instead of duplicating the bid", async () => {
    await imp(a, "tender_results", [HEAD, "KAUH,KA-1,,2025-08-01,,Pipette tips,,100,Rival Co,no,2.000,won"].join("\n"));
    await imp(a, "tender_results", [HEAD, "KAUH,KA-1,,2025-08-01,,Pipette tips,,100,Rival Co,no,2.250,won"].join("\n"));
    const rows = await q<{ unit_price: string }>(`select b.unit_price from tender_bids b join tender_archive_lines l on l.id = b.line_id where b.company_id = $1 and l.item_name = 'Pipette tips'`, [a]);
    expect(rows).toEqual([{ unit_price: "2.250" }]);
  });

  it("does not touch another company's history, and the dry run writes nothing", async () => {
    const before = await count("tender_bids", b);
    const dry = await imp(b, "tender_results", [HEAD, "MOH,MOH-2025-14,,2025-03-01,,Lancets,,10,Rival Co,no,0.100,won"].join("\n"), { dryRun: true });
    expect(dry).toMatchObject({ dryRun: true, wrote: false, rowsAccepted: 1 });
    expect(await count("tender_bids", b)).toBe(before);
    await imp(b, "tender_results", [HEAD, "MOH,MOH-2025-14,,2025-03-01,,Lancets,,10,Rival Co,no,0.100,won"].join("\n"));
    expect(await count("tender_archive", b)).toBe(1);
    expect(await count("tender_archive", a)).toBeGreaterThan(1);
  });
});

describe("results file prefilled from a decided tender", () => {
  it("imports once items and prices are added, and the tender then shows its bids in Price history", async () => {
    const tender = { authority: "DRMS", tenderNo: "DRMS-26-7", title: "Gloves", status: "lost", awardDate: "2026-09-05", winnerName: "Rival Co" } as const;
    expect(await archivedBidCount(db as unknown as Db, a, "DRMS", "DRMS-26-7")).toBe(0);
    const [head, ours, theirs] = prefillRows(tender, "A");
    const fill = (r: string[], price: string) => r.map((c, i) => (i === head!.indexOf("Item") ? "Nitrile gloves M" : i === head!.indexOf("Unit price") ? price : c));
    const out = await imp(a, "tender_results", rowsToCsv([head!, fill(ours!, "0.050"), fill(theirs!, "0.044")]));
    expect(out).toMatchObject({ status: "accepted", rowsAccepted: 2, wrote: true });
    expect(await archivedBidCount(db as unknown as Db, a, "DRMS", "DRMS-26-7")).toBe(2);
    expect(await archivedBidCount(db as unknown as Db, b, "DRMS", "DRMS-26-7")).toBe(0); // other company
    expect(await archivedBidCount(db as unknown as Db, a, "DRMS", null)).toBe(0);
    const bids = await q<{ bidder: string; is_own: boolean; outcome: string }>(
      `select bidder, is_own, outcome from tender_bids where company_id = $1 and line_id in (select id from tender_archive_lines where item_name = 'Nitrile gloves M') order by bidder`,
      [a],
    );
    expect(bids).toEqual([
      { bidder: "A", is_own: true, outcome: "lost" },
      { bidder: "Rival Co", is_own: false, outcome: "won" },
    ]);
  });
});
