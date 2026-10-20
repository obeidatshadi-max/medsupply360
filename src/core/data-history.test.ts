import { describe, expect, it } from "vitest";
import { DATA_ACTIONS, areaOf, describeAction, isDataAction } from "./data-history";

describe("describeAction", () => {
  it("says which stages a tender moved between", () => {
    expect(describeAction("tender.moved", { from: "open", to: "preparing" })).toBe("Moved a tender from Open to Preparing");
  });

  it("falls back to general wording when details are missing", () => {
    expect(describeAction("tender.moved", null)).toBe("Moved a tender to a new stage");
    expect(describeAction("tender.moved", { from: "nonsense", to: "open" })).toBe("Moved a tender to a new stage");
  });

  it("describes an import with its file and row count", () => {
    expect(describeAction("import.run", { kind: "sales", fileName: "sales-sep.csv", rowsAccepted: 1 })).toContain("sales-sep.csv): 1 row loaded");
    expect(describeAction("import.run", { kind: "sales", fileName: "a.csv", rowsAccepted: 42 })).toContain("42 rows loaded");
  });

  it("has a sentence and an area for every listed action", () => {
    for (const a of DATA_ACTIONS) {
      expect(describeAction(a, {}).length).toBeGreaterThan(5);
      expect(["Tenders", "Uploads", "Support functions", "Company profile"]).toContain(areaOf(a));
    }
  });

  it("names the indicator and the reading for support actions", () => {
    expect(describeAction("support.reading_recorded", { name: "On-time deliveries", reading: "88%" })).toBe("Recorded a reading (On-time deliveries): 88%");
    expect(describeAction("support.reading_recorded", {})).toBe("Recorded a reading");
    expect(describeAction("support.indicator_added", { name: "Vacancy days" })).toBe("Added a support indicator (Vacancy days)");
    expect(areaOf("support.indicator_deleted")).toBe("Support functions");
    expect(areaOf("import.run")).toBe("Uploads");
  });

  it("lists only data actions", () => {
    expect(isDataAction("tender.created")).toBe(true);
    expect(isDataAction("auth.login")).toBe(false);
  });
});
