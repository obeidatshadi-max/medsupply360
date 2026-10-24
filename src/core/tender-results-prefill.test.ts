import { describe, expect, it } from "vitest";
import { validateImport } from "./import/validate";
import { defuse, hasAwardResult, prefillFileName, prefillRows, rowsToCsv, type PrefillTender } from "./tender-results-prefill";

const base: PrefillTender = { authority: "KAUH", tenderNo: "KAUH-26-040", title: "Anaesthesia workstations", status: "lost", awardDate: "2026-09-05", winnerName: "Competitor A" };

describe("prefilled award results", () => {
  it("applies to won and later stages and to lost, nothing earlier", () => {
    expect(["won", "contracted", "delivered", "collected", "lost"].every((s) => hasAwardResult(s as never))).toBe(true);
    expect(["pipeline", "open", "preparing", "submitted", "technical_review", "financial_review", "cancelled"].some((s) => hasAwardResult(s as never))).toBe(false);
  });

  it("fills the known cells for our bid and leaves item and price cells empty", () => {
    const [head, ours] = prefillRows(base, "Sadaf Medical");
    const at = (row: string[], heading: string) => row[head!.indexOf(heading)];
    expect(head).toContain("Item");
    expect(at(ours!, "Authority")).toBe("KAUH");
    expect(at(ours!, "Tender no")).toBe("KAUH-26-040");
    expect(at(ours!, "Award date")).toBe("2026-09-05");
    expect(at(ours!, "Bidder")).toBe("Sadaf Medical");
    expect(at(ours!, "Our bid")).toBe("Yes");
    expect(at(ours!, "Result")).toBe("lost");
    expect(at(ours!, "Item")).toBe("");
    expect(at(ours!, "Unit price")).toBe("");
  });

  it("adds the winner's row only for a lost tender whose winner is known", () => {
    expect(prefillRows(base, "Sadaf Medical")).toHaveLength(3);
    expect(prefillRows({ ...base, winnerName: null }, "Sadaf Medical")).toHaveLength(2);
    const won = prefillRows({ ...base, status: "contracted", winnerName: "Ignored" }, "Sadaf Medical");
    expect(won).toHaveLength(2);
    expect(won[1]![won[0]!.indexOf("Result")]).toBe("won");
  });

  it("is a file the importer recognises once the items are typed in", () => {
    const rows = prefillRows(base, "Sadaf Medical");
    const h = rows[0]!;
    const fill = (r: string[], item: string, price: string) => r.map((c, i) => (i === h.indexOf("Item") ? item : i === h.indexOf("Unit price") ? price : c));
    const csv = rowsToCsv([h, fill(rows[1]!, "Anaesthesia workstation", "448750"), fill(rows[2]!, "Anaesthesia workstation", "411700")]);
    const out = validateImport("tender_results", csv, { today: "2026-10-24" });
    expect(out.fatal).toBeNull();
    expect(out.rejected).toEqual([]);
    expect(out.accepted.map((r) => [r.values.bidder, r.values.ourBid, r.values.result, r.values.unitPrice, r.values.awardDate])).toEqual([
      ["Sadaf Medical", true, "lost", "448750.000", "2026-09-05"],
      ["Competitor A", false, "won", "411700.000", "2026-09-05"],
    ]);
    // Left empty, the prefilled rows are not accepted: the item name is required.
    expect(validateImport("tender_results", rowsToCsv(rows), { today: "2026-10-24" }).accepted).toEqual([]);
  });

  it("defuses typed text that a spreadsheet would run as a formula, and leaves everything else alone", () => {
    expect(["=HYPERLINK(\"http://x\")", "+1", "-2", "@SUM(A1)", "\tx", "\rx"].map(defuse)).toEqual(["'=HYPERLINK(\"http://x\")", "'+1", "'-2", "'@SUM(A1)", "'\tx", "'\rx"]);
    expect(["Nitrile gloves", "MOH-26-1", "2026-09-05", ""].map(defuse)).toEqual(["Nitrile gloves", "MOH-26-1", "2026-09-05", ""]);
    const [h, ours, theirs] = prefillRows({ ...base, title: "=1+1", winnerName: "@evil" }, "-Co");
    expect([ours![h!.indexOf("Tender title")], ours![h!.indexOf("Bidder")], theirs![h!.indexOf("Bidder")]]).toEqual(["'=1+1", "'-Co", "'@evil"]);
    expect(ours![h!.indexOf("Tender no")]).toBe("KAUH-26-040"); // codes and dates stay untouched
  });

  it("quotes commas and builds a safe file name", () => {
    expect(rowsToCsv([["a,b", 'c"d']])).toBe('﻿"a,b","c""d"\r\n');
    expect(prefillFileName({ authority: "MOH", tenderNo: "MOH/26 7" })).toBe("tender-results-MOH-MOH_26_7.csv");
    expect(prefillFileName({ authority: "MOH", tenderNo: null })).toBe("tender-results-MOH-no-number.csv");
  });
});
