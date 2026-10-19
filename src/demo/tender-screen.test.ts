import { describe, expect, it } from "vitest";
import { AUTHORITIES } from "@/core/tender-flow";
import { jod, pct } from "@/lib/format";
import { DEMO_TENDERS, demoTenderOverview } from "./tender-demo";
import { authorityLabel, tenderCsvRows, tenderDetailHtml, tenderScreenHtml } from "./tender-screen";

describe("demo tender screen", () => {
  const o = demoTenderOverview();

  it("shows the same figures as the in-app sample overview", () => {
    const html = tenderScreenHtml({ generic: false });
    expect(html).toContain(jod(o.payments.unpaid));
    expect(html).toContain(jod(o.guarantees.active));
    expect(html).toContain(jod(o.guarantees.expiredNotReturned));
    expect(html).toContain(`Win rate: ${pct(o.results.winRate!)}`);
    for (const p of o.phases.filter((x) => x.key !== "closed")) expect(html).toContain(jod(p.value));
    for (const t of DEMO_TENDERS) expect(html).toContain(t.title);
  });

  it("names the real authorities only for the Sadaf preset", () => {
    const sadaf = tenderScreenHtml({ generic: false });
    const other = tenderScreenHtml({ generic: true }) + DEMO_TENDERS.map((t) => tenderDetailHtml(t.id, true)).join("") + JSON.stringify(tenderCsvRows(true));
    for (const a of AUTHORITIES) {
      expect(sadaf).toContain(a.code);
      expect(other).not.toContain(a.code);
      expect(other).not.toContain(a.name);
    }
    expect(authorityLabel("MOH", true)).toBe("Authority A");
    expect(authorityLabel("KAUH", true)).toBe("Authority E");
  });

  it("narrows the tender list with the search box but keeps the overview whole", () => {
    const html = tenderScreenHtml({ generic: false, query: "dialysis" });
    expect(html).toContain("2 tenders · search by owner");
    expect(html).toContain(jod(o.payments.unpaid));
    expect(tenderCsvRows(false, "dialysis")).toHaveLength(3);
    expect(tenderCsvRows(false)).toHaveLength(DEMO_TENDERS.length + 1);
  });

  it("opens a tender with its guarantees, invoices and history", () => {
    const html = tenderDetailHtml("d8", false)!;
    expect(html).toContain("INV-2026-0433");
    expect(html).toContain("PG-0017");
    expect(html).toContain(`still unpaid ${jod(360000)}`);
    expect(html).toContain("Installed and accepted");
    expect(tenderDetailHtml("d10", false)).toContain("Expired");
    expect(tenderDetailHtml("missing", false)).toBeNull();
  });

  it("shows each tender's owner, finds tenders by owner, and says when nobody is assigned", () => {
    const html = tenderScreenHtml({ generic: false });
    for (const t of DEMO_TENDERS) if (t.owner) expect(html).toContain(t.owner);
    expect(html).toContain("Not assigned");
    const mine = DEMO_TENDERS.filter((t) => t.owner === "Khaled Mansour").length;
    expect(tenderScreenHtml({ generic: false, query: "Khaled" })).toContain(`${mine} tenders · search by owner`);
    expect(tenderDetailHtml("d1", false)).toContain("Khaled Mansour");
    expect(tenderDetailHtml("d12", false)).toContain("Not assigned yet");
    expect(tenderCsvRows(false)[0]).toContain("Owner");
  });

  it("escapes what it prints", () => {
    expect(tenderScreenHtml({ generic: false, query: "<script>" })).not.toContain("<script>");
  });
});
