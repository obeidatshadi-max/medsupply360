import { describe, expect, it } from "vitest";
import { GLOSSARY, GLOSSARY_ENTRIES, PAGE_TERMS, glossaryEntry, hasMore } from "./glossary";
import { DEMO_ALERT_TOPIC, INSIGHT_HELP } from "./insight-help";

describe("glossary data", () => {
  it("has a unique id and a unique term for every entry", () => {
    expect(new Set(GLOSSARY_ENTRIES.map((e) => e.id)).size).toBe(GLOSSARY_ENTRIES.length);
    expect(new Set(GLOSSARY_ENTRIES.map((e) => e.term)).size).toBe(GLOSSARY_ENTRIES.length);
  });

  it("uses kebab-case ids and a short plain sentence", () => {
    for (const e of GLOSSARY_ENTRIES) {
      expect(e.id).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(e.short.length).toBeGreaterThan(10);
      expect(e.short.endsWith(".")).toBe(true);
      // Short means short: one or two sentences, no wall of text.
      expect(e.short.split(/\s+/).length).toBeLessThanOrEqual(40);
    }
  });

  it("keeps the older flat GLOSSARY map in step with the entries", () => {
    for (const e of GLOSSARY_ENTRIES) expect(GLOSSARY[e.term]).toBe(e.short);
  });

  it("finds an entry by term and returns undefined for an unknown one", () => {
    expect(glossaryEntry("Overdue")?.id).toBe("overdue");
    expect(glossaryEntry("Not a term")).toBeUndefined();
  });

  it("explains every term that a screen lists", () => {
    for (const [page, terms] of Object.entries(PAGE_TERMS)) {
      for (const t of terms) expect(glossaryEntry(t), `${page}: ${t}`).toBeDefined();
    }
  });

  it("has the extra levels only on the terms that need them, and each extra part is a sentence", () => {
    const deeper = GLOSSARY_ENTRIES.filter(hasMore);
    expect(deeper.length).toBeGreaterThanOrEqual(10);
    for (const e of deeper) {
      for (const part of [e.example, e.why, e.action]) if (part) expect(part.endsWith(".")).toBe(true);
    }
    // The terms a CEO most often misreads must have the full set.
    for (const t of ["Overdue", "Aging", "Stock cover", "Expiry loss", "Gross margin", "Win rate"]) {
      const e = glossaryEntry(t)!;
      expect(e.example && e.why && e.action, t).toBeTruthy();
    }
  });

  it("is ready for Arabic without inventing it", () => {
    for (const e of GLOSSARY_ENTRIES) expect((e as { ar?: unknown }).ar).toBeUndefined();
  });
});

describe("insight help", () => {
  it("covers every alert topic with the three parts", () => {
    for (const topic of ["sales", "cash", "overdue", "stock"] as const) {
      const h = INSIGHT_HELP[topic];
      expect(h.means).toBeTruthy();
      expect(h.why).toBeTruthy();
      expect(h.next).toBeTruthy();
    }
  });

  it("words the cause as a possibility, never as a proven fact", () => {
    for (const h of Object.values(INSIGHT_HELP)) expect(h.means).toMatch(/\b(may|possible|can)\b/i);
  });

  it("maps the demo alert ids to real topics", () => {
    for (const topic of Object.values(DEMO_ALERT_TOPIC)) expect(INSIGHT_HELP[topic]).toBeDefined();
  });
});
