import { describe, expect, it } from "vitest";
import { AUTHORITIES } from "@/core/tender-flow";
import { jod, pct } from "@/lib/format";
import { DEMO_TENDERS, demoTenderOverview } from "./tender-demo";
import { authorityLabel, tenderCsvRows, tenderDetailHtml, tenderResultsPrefillRows, tenderScreenHtml } from "./tender-screen";

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

  it("offers the prefilled Price history file for decided tenders only, with our row and the known winner", () => {
    const decided = DEMO_TENDERS.filter((t) => ["won", "contracted", "delivered", "collected", "lost"].includes(t.status));
    expect(decided.length).toBeGreaterThan(0);
    for (const t of DEMO_TENDERS) {
      const isDecided = decided.includes(t);
      const html = tenderDetailHtml(t.id, false)!;
      if (isDecided) expect(html).toContain(`data-prefill="${t.id}"`);
      else expect(html).not.toContain("data-prefill");
      expect(tenderResultsPrefillRows(t.id, false) !== null).toBe(isDecided);
    }
    const lost = tenderResultsPrefillRows("d10", false)!;
    const h = lost[0]!;
    expect(lost).toHaveLength(5); // head, our two item lines, the winner's two item lines
    expect(lost[1]![h.indexOf("Bidder")]).toBe("Sadaf Medical");
    expect(lost[1]![h.indexOf("Award date")]).toBe("2026-09-05");
    expect(lost[1]![h.indexOf("Item")]).toBe("Anaesthesia workstation");
    expect(lost[1]![h.indexOf("Unit price")]).toBe("59875.000");
    expect(lost[3]![h.indexOf("Bidder")]).toBe("Competitor A");
    expect(lost[3]![h.indexOf("Unit price")]).toBe("");
    expect(tenderResultsPrefillRows("nope", false)).toBeNull();
  });

  it("shows the time from handing in the bid to the decision, as the overview computes it", () => {
    const td = o.timeToDecision;
    expect(td.count).toBeGreaterThan(3);
    const html = tenderScreenHtml({ generic: false });
    expect(html).toContain(`${td.average} days on average, ${td.median} typical, from ${td.fastest} to ${td.slowest}`);
    expect(tenderDetailHtml("d3", false)).toContain("Date submitted");
    expect(tenderDetailHtml("d3", false)).toContain("Bid opening");
  });

  it("splits the unpaid tender money by due date, from payment terms and a typed date, as the overview computes it", () => {
    const p = o.payments;
    expect(p.overdue).toBe(203000); // INV-2026-0433: due date typed 5 Oct, 3 days before the demo date
    expect(p.overdueInvoices).toBe(1);
    expect(p.oldestOverdueDays).toBe(3);
    expect(p.notYetDue).toBe(152660); // INV-2026-0412: 14 Sep + 60 days = 13 Nov
    expect(p.noDueDate).toBe(0);
    expect(p.overdue + p.notYetDue + p.noDueDate).toBe(p.unpaid);
    const html = tenderScreenHtml({ generic: false });
    expect(html).toContain("Overdue (1 invoice, oldest 3 days)");
    expect(html).toContain(jod(p.overdue));
    const drawer = tenderDetailHtml("d8", false)!;
    expect(drawer).toContain("invoice date + 60 days");
    expect(drawer).toContain("entered on the invoice");
    expect(drawer).toContain("3 days overdue");
    expect(tenderDetailHtml("d8", false)).toContain("Payment terms");
  });

  it("shows a tender's item lines and totals in its drawer, and nothing for a tender without lines", () => {
    const html = tenderDetailHtml("d10", false)!;
    expect(html).toContain("Item lines");
    expect(html).toContain("Anaesthesia workstation");
    expect(html).toContain(`Our bid total ${jod(448750)}.`);
    expect(html).toContain(`Authority estimate total ${jod(468300)}.`);
    expect(tenderDetailHtml("d1", false)).toContain("Our bid total is not complete: 2 lines without our price.");
    expect(tenderDetailHtml("d11", false)).not.toContain("Item lines");
  });

  it("names the real authorities only for the Sadaf preset", () => {
    const sadaf = tenderScreenHtml({ generic: false });
    const other = tenderScreenHtml({ generic: true }) + DEMO_TENDERS.map((t) => tenderDetailHtml(t.id, true)).join("") + JSON.stringify(tenderCsvRows(true)) + JSON.stringify(DEMO_TENDERS.map((t) => tenderResultsPrefillRows(t.id, true)));
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
    expect(html).toContain(`still unpaid ${jod(355660)}`);
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
