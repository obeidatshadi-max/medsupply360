import { describe, expect, it } from "vitest";
import { detectKind } from "./detect";
import { SPECS, type ImportKind } from "./specs";
import { hasTemplate, headingOf, templateCsv } from "./template";
import { validateImport } from "./validate";

const KINDS: ImportKind[] = ["tenders", "sales_people", "installed_units"];

describe("templates", () => {
  it("are recognised as the type they were made for", () => {
    for (const kind of KINDS) expect(detectKind(templateCsv(kind)), kind).toEqual({ kind, certain: true });
  });

  it("pass the importer with their example row and no complaint", () => {
    for (const kind of KINDS) {
      const r = validateImport(kind, templateCsv(kind), { today: "2026-10-20" });
      expect(r.fatal, kind).toBeNull();
      expect(r.rejected, kind).toEqual([]);
      expect(r.accepted, kind).toHaveLength(1);
    }
  });

  it("heads each column with its first accepted spelling", () => {
    expect(headingOf("tenders", "tenderNo")).toBe("Tender no");
    expect(templateCsv("tenders").split("\r\n")[0]).toContain("Estimated value");
    expect(hasTemplate("sales")).toBe(false);
    expect(SPECS.tenders.fields.length).toBeGreaterThan(5);
  });
});
