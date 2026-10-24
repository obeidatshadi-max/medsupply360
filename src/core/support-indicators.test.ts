import { describe, expect, it } from "vitest";
import { cleanIndicator, cleanReading, distanceFromTarget, indicatorStatus, parseAmount, sortIndicators, summarize, targetText, valueText, type IndicatorForm } from "./support-indicators";

const form = (over: Partial<IndicatorForm> = {}): IndicatorForm => ({
  function: "Procurement",
  name: "Supplier deliveries on time",
  unit: "%",
  direction: "at_least",
  target: "90",
  responsible: "Procurement manager",
  consequence: "Two consumable backorders",
  ...over,
});

describe("parseAmount", () => {
  it("reads plain numbers, thousands commas and Arabic digits, and refuses anything else", () => {
    expect(parseAmount("88")).toBe(88);
    expect(parseAmount("1,250.5")).toBe(1250.5);
    expect(parseAmount("٩٥")).toBe(95);
    expect(parseAmount("12.3456")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("2000000000")).toBeNull();
  });
});

describe("cleanIndicator", () => {
  it("accepts a complete indicator and tidies the text", () => {
    expect(cleanIndicator(form({ name: "  Supplier   deliveries on time " }))).toEqual({
      ok: true,
      value: { function: "Procurement", name: "Supplier deliveries on time", unit: "%", direction: "at_least", target: 90, responsible: "Procurement manager", consequence: "Two consumable backorders" },
    });
  });

  it("keeps responsible person, consequence and unit optional", () => {
    const r = cleanIndicator(form({ responsible: "", consequence: "", unit: "" }));
    expect(r).toMatchObject({ ok: true, value: { responsible: null, consequence: null, unit: "" } });
  });

  it("refuses an unknown department, a short name, a missing direction and a bad target", () => {
    for (const bad of [form({ function: "Sales" }), form({ name: "ab" }), form({ name: "123456" }), form({ direction: "" }), form({ target: "ninety" }), form({ unit: "x".repeat(21) })]) {
      expect(cleanIndicator(bad).ok).toBe(false);
    }
  });
});

describe("cleanReading", () => {
  it("accepts a figure measured today or earlier", () => {
    expect(cleanReading({ actual: "88", measuredOn: "2026-10-20" }, "2026-10-20")).toEqual({ ok: true, value: { actual: 88, measuredOn: "2026-10-20" } });
  });
  it("refuses a future date, an invalid date and a non-number", () => {
    expect(cleanReading({ actual: "88", measuredOn: "2026-10-21" }, "2026-10-20").ok).toBe(false);
    expect(cleanReading({ actual: "88", measuredOn: "2026-02-30" }, "2026-10-20").ok).toBe(false);
    expect(cleanReading({ actual: "x", measuredOn: "2026-10-01" }, "2026-10-20").ok).toBe(false);
  });
});

describe("status", () => {
  it("judges a minimum and a maximum target, equal counting as met", () => {
    expect(indicatorStatus("at_least", 95, 88)).toBe("missed");
    expect(indicatorStatus("at_least", 95, 95)).toBe("met");
    expect(indicatorStatus("at_most", 30, 42)).toBe("missed");
    expect(indicatorStatus("at_most", 30, 30)).toBe("met");
    expect(indicatorStatus("at_most", 30, null)).toBe("no_reading");
  });
  it("measures the miss in the unit and is zero when on target", () => {
    expect(distanceFromTarget("at_least", 95, 88)).toBe(7);
    expect(distanceFromTarget("at_most", 30, 42)).toBe(12);
    expect(distanceFromTarget("at_most", 30, 20)).toBe(0);
  });
});

describe("text", () => {
  it("writes values and targets the way the page shows them", () => {
    expect(valueText(88, "%")).toBe("88%");
    expect(valueText(42, "days")).toBe("42 days");
    expect(valueText(4800, "")).toBe("4800");
    expect(valueText(12.5, "%")).toBe("12.5%");
    expect(targetText("at_least", 95, "%")).toBe("≥ 95%");
    expect(targetText("at_most", 30, "days")).toBe("≤ 30 days");
  });
});

describe("sortIndicators and summarize", () => {
  const rows = [
    { department: "Logistics", name: "On-time deliveries", direction: "at_least" as const, target: 95, actual: 88 },
    { department: "HR & development", name: "Vacancy days", direction: "at_most" as const, target: 30, actual: 42 },
    { department: "Customer support", name: "Cases solved in time", direction: "at_least" as const, target: 95, actual: 97 },
    { department: "Tender support", name: "Complete documents", direction: "at_least" as const, target: 98, actual: null },
  ];
  it("puts the biggest relative miss first, then no reading, then on target", () => {
    expect(sortIndicators(rows).map((r) => r.name)).toEqual(["Vacancy days", "On-time deliveries", "Complete documents", "Cases solved in time"]);
  });
  it("counts the tiles", () => {
    expect(summarize(rows)).toEqual({ total: 4, missed: 2, met: 1, noReading: 1, departments: 4 });
  });
});
