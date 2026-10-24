import { describe, expect, it } from "vitest";
import { cellText, readSheetGrid, readWorkbook } from "./workbook";
import { parseCsv } from "./csv";

describe("cellText", () => {
  it("writes dates as calendar days, yes/no as words and numbers plainly", () => {
    expect(cellText(new Date(Date.UTC(2026, 2, 5)))).toBe("2026-03-05");
    expect(cellText(true)).toBe("Yes");
    expect(cellText(false)).toBe("No");
    expect(cellText(1250.5)).toBe("1250.5");
    expect(cellText(null)).toBe("");
    expect(cellText("  Amman  ")).toBe("Amman");
    expect(cellText(new Date("nope"))).toBe("");
  });
});

describe("readSheetGrid", () => {
  const unitHeader = ["Unit code", "Customer code", "Product code", "Unit name", "Installed on", "Warranty end", "Service", "Expected monthly consumables"];

  it("recognises a sheet and writes CSV the importer can parse", () => {
    const r = readSheetGrid({
      sheet: "Installed equipment",
      data: [unitHeader, ["U-1", "C-1", "P-1", 'Analyzer "XN", room 2', new Date(Date.UTC(2025, 0, 15)), null, "Active", 120], [null, null, null, null, null, null, null, null]],
    });
    expect(r.kind).toBe("installed_units");
    expect(r.rows).toBe(1);
    expect(r.skipped).toBeNull();
    const [head, row] = parseCsv(r.csv, ",").records;
    expect(head).toEqual(unitHeader);
    expect(row).toEqual(["U-1", "C-1", "P-1", 'Analyzer "XN", room 2', "2025-01-15", "", "Active", "120"]);
  });

  it("finds the header row under a title and date range", () => {
    const r = readSheetGrid({ sheet: "Sheet1", data: [["Alpha ERP export"], ["From 2026-01-01 to 2026-03-31"], [], unitHeader, ["U-1", "C-1", "P-1", "Analyzer", null, null, null, null]] });
    expect(r.kind).toBe("installed_units");
    expect(r.headerRow).toBe(4);
    expect(r.rows).toBe(1);
    expect(r.csv.startsWith("Unit code,")).toBe(true);
  });

  it("skips guide tabs, empty tabs and header-only tabs without a type", () => {
    expect(readSheetGrid({ sheet: "Read me", data: [["Step", "What to do"], ["1", "Fill the tabs"]] }).skipped).toMatch(/not data/);
    expect(readSheetGrid({ sheet: "Examples", data: [unitHeader, ["U-1"]] }).skipped).toMatch(/not data/);
    expect(readSheetGrid({ sheet: "E06 Stock", data: [] }).skipped).toBe("The tab is empty.");
    const headerOnly = readSheetGrid({ sheet: "Installed equipment", data: [unitHeader, [], []] });
    expect(headerOnly.kind).toBe("installed_units");
    expect(headerOnly.skipped).toMatch(/Only a heading row/);
  });

  it("leaves the type empty for an unknown sheet and lists nothing it cannot back up", () => {
    const r = readSheetGrid({ sheet: "Misc list", data: [["foo", "bar"], [1, 2]] });
    expect(r.kind).toBeNull();
    expect(r.candidates).toEqual([]);
    expect(r.rows).toBe(1);
  });

  it("does not accept a type outside the channel", () => {
    const r = readSheetGrid({ sheet: "Installed equipment", data: [unitHeader, ["U-1", "C-1", "P-1", "Analyzer", null, null, null, null]] }, ["products"]);
    expect(r.kind).toBeNull();
    expect(r.candidates).toEqual(["installed_units"]);
  });
});

describe("readWorkbook", () => {
  it("reads every tab of a workbook on its own", () => {
    const out = readWorkbook([
      { sheet: "Read me", data: [["How to"]] },
      { sheet: "E01 Products", data: [["Product code", "Product name", "Category", "Unit"], ["P-1", "Reagent", "Consumables", "box"]] },
      { sheet: "E02 Customers", data: [["Customer code", "Customer name", "City"], ["C-1", "KHCC", "Amman"]] },
    ]);
    expect(out.map((s) => s.kind)).toEqual([null, "products", "customers"]);
    expect(out[0]!.skipped).not.toBeNull();
  });
});
