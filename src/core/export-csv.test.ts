import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { collectExport, exportFileName, fileSlug, toCsv } from "./export-csv";
import { applySearch } from "./page-search";

describe("toCsv", () => {
  it("starts with a BOM, ends each line with CRLF and quotes what needs it", () => {
    expect(toCsv([["a", 'b "c"', "d,e"], ["x"]])).toBe('﻿a,"b ""c""","d,e"\r\nx\r\n');
  });
  it("keeps Arabic text as it is", () => {
    expect(toCsv([["مستشفى"]])).toContain("مستشفى");
  });
});

describe("file names", () => {
  it("makes a plain slug and names the file with the date", () => {
    expect(fileSlug("Sales & accounts")).toBe("sales-accounts");
    expect(fileSlug("???")).toBe("screen");
    expect(exportFileName("Owner overview", "2026-10-20")).toBe("MedSupply360_owner-overview_2026-10-20.csv");
  });
});

describe("collectExport", () => {
  const page = () =>
    new JSDOM(`<main>
      <div data-figure><p>Sales</p><p>JOD 100</p><p>This year</p></div>
      <section aria-label="Customers"><h2>Customers</h2>
        <table><thead><tr><th>Name</th><th>Sales</th></tr></thead><tbody>
          <tr><td>Hospital A</td><td>JOD 60</td></tr><tr><td>Clinic  B</td><td>JOD 40</td></tr>
        </tbody></table></section>
      <article><p>On-time deliveries</p><p>88% against 95%</p></article>
    </main>`).window.document;

  it("lists figures, each table with its heading, and cards", () => {
    expect(collectExport(page())).toEqual([
      ["Figures"],
      ["Figure", "Value", "Note"],
      ["Sales", "JOD 100", "This year"],
      [],
      ["Customers"],
      ["Name", "Sales"],
      ["Hospital A", "JOD 60"],
      ["Clinic B", "JOD 40"],
      [],
      ["Cards"],
      ["On-time deliveries · 88% against 95%"],
    ]);
  });

  it("leaves out the rows and cards the search has hidden", () => {
    const doc = page();
    applySearch(doc, "hospital");
    const rows = collectExport(doc);
    expect(rows.flat()).toContain("Hospital A");
    expect(rows.flat()).not.toContain("Clinic B");
    expect(rows.flat()).not.toContain("On-time deliveries · 88% against 95%");
  });

  it("is empty when the screen has nothing to export", () => {
    expect(collectExport(new JSDOM("<main><p>Hello</p></main>").window.document)).toEqual([]);
  });
});
