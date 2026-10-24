import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { HIDDEN_ATTR, applySearch, matchesSearch, normalizeForSearch, searchWords } from "./page-search";

describe("matching", () => {
  it("ignores case, extra spaces and Arabic diacritics", () => {
    expect(normalizeForSearch("  Hospital   A ")).toBe("hospital a");
    expect(normalizeForSearch("مُسْتَشْفَى")).toBe(normalizeForSearch("مستشفى"));
  });
  it("needs every word, in any order", () => {
    const w = searchWords("hospital amman");
    expect(matchesSearch("Amman Hospital A", w)).toBe(true);
    expect(matchesSearch("Hospital A, Irbid", w)).toBe(false);
  });
  it("matches everything for an empty query", () => {
    expect(searchWords("   ")).toEqual([]);
    expect(matchesSearch("anything", [])).toBe(true);
  });
});

describe("applySearch", () => {
  const page = () => {
    const dom = new JSDOM(`<main>
      <table><thead><tr><th>Customer</th></tr></thead><tbody>
        <tr><td>Hospital A</td></tr><tr><td>Clinic B</td></tr><tr><td>Hospital C</td></tr>
      </tbody></table>
      <article>Support: On-time deliveries</article>
      <article data-search-skip>Filter buttons</article>
    </main>`);
    return dom.window.document;
  };

  it("hides rows and cards that do not match and counts what is left", () => {
    const doc = page();
    expect(applySearch(doc, "hospital")).toEqual({ total: 4, shown: 2 });
    const rows = [...doc.querySelectorAll("tbody tr")];
    expect(rows.map((r) => r.hasAttribute(HIDDEN_ATTR))).toEqual([false, true, false]);
    expect(doc.querySelector("article")!.hasAttribute(HIDDEN_ATTR)).toBe(true);
  });

  it("leaves the header row and anything marked to skip alone", () => {
    const doc = page();
    applySearch(doc, "zzz");
    expect(doc.querySelector("thead tr")!.hasAttribute(HIDDEN_ATTR)).toBe(false);
    expect(doc.querySelector("[data-search-skip]")!.hasAttribute(HIDDEN_ATTR)).toBe(false);
  });

  it("shows everything again when the query is cleared", () => {
    const doc = page();
    applySearch(doc, "clinic");
    expect(applySearch(doc, "")).toEqual({ total: 4, shown: 4 });
    expect(doc.querySelectorAll(`[${HIDDEN_ATTR}]`)).toHaveLength(0);
  });
});
