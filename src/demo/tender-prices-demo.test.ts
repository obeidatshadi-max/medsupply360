import { describe, expect, it } from "vitest";
import { detectKind } from "@/core/import/detect";
import { SPECS } from "@/core/import/specs";
import { mapColumns } from "@/core/import/validate";
import { parseCsv } from "@/core/import/csv";
import { coverageOf, gapDistribution, summarizeItems } from "@/core/tender-prices";
import { TENDER_RESULTS_GUIDE, templateCsv } from "@/core/tender-results-guide";
import { DEMO_PRICES_AS_OF, demoBidRows, demoTenderResultsCsv } from "./tender-prices-demo";

describe("the tender results file as described to people", () => {
  it("uses only headings the importer reads, each once, and the template is recognised as this file", () => {
    const header = TENDER_RESULTS_GUIDE.map((c) => c.column);
    const { columnOf, ignored, ambiguous } = mapColumns(SPECS.tender_results, header);
    expect(ignored).toEqual([]);
    expect(ambiguous).toEqual([]);
    expect(columnOf.size).toBe(header.length);
    expect(detectKind(templateCsv())).toEqual({ kind: "tender_results", certain: true });
  });

  it("marks exactly the columns the importer requires as required", () => {
    const required = SPECS.tender_results.fields.filter((f) => f.required).map((f) => f.key).sort();
    const { columnOf } = mapColumns(SPECS.tender_results, TENDER_RESULTS_GUIDE.map((c) => c.column));
    const guideRequired = TENDER_RESULTS_GUIDE.filter((c) => c.level === "required").map((c) => [...columnOf].find(([, i]) => i === TENDER_RESULTS_GUIDE.indexOf(c))![0]).sort();
    expect(guideRequired).toEqual(required);
  });

  it("gives a template with headings and no data rows", () => {
    expect(parseCsv(templateCsv()).records).toHaveLength(1);
  });
});

describe("the fictional sample", () => {
  it("is the same every time and passes the real importer without a single rejected row", () => {
    expect(demoTenderResultsCsv()).toBe(demoTenderResultsCsv());
    const rows = demoBidRows();
    // Locked on purpose: the app sample and the promotional demo must show the same numbers in every JavaScript engine.
    expect(rows.length).toBe(762);
    expect(coverageOf(rows)).toMatchObject({ tenders: 70, items: 199 });
    expect(rows.every((r) => r.awardDate <= DEMO_PRICES_AS_OF)).toBe(true);
  });

  it("covers about four years and five authorities that publish differently", () => {
    const c = coverageOf(demoBidRows());
    expect(c.firstDate! < "2023-01-01").toBe(true);
    expect(c.lastDate! > "2026-06-01").toBe(true);
    expect(c.byAuthority.map((a) => a.authority)).toEqual(["DRMS", "JUH", "KAUH", "KHCC", "MOH"]);
    const share = (code: string) => {
      const a = c.byAuthority.find((x) => x.authority === code)!;
      return a.itemsWithBidderPrices / a.items;
    };
    expect(share("MOH")).toBeGreaterThan(0.9);
    expect(share("DRMS")).toBeLessThan(0.7); // winner only (plus our own price when we bid)
    expect(c.itemsWithWinnerPrice).toBeGreaterThan(0.85 * c.items);
  });

  it("has enough history per item to price from, and shows that we tend to lose by a little", () => {
    const items = summarizeItems(demoBidRows());
    expect(items.length).toBe(14);
    expect(items.filter((i) => i.basis === "good").length).toBeGreaterThan(8);
    const gaps = gapDistribution(demoBidRows());
    expect(gaps.placed).toBeGreaterThan(50);
    const lostCloseCount = gaps.buckets.filter((b) => b.key === "within5" || b.key === "within10").reduce((s, b) => s + b.count, 0);
    expect(lostCloseCount).toBeGreaterThan(0);
  });
});
