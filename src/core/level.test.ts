import { describe, expect, it } from "vitest";
import { ROLES } from "./permissions";
import { ADVANCED_ONLY, DEFAULT_LEVEL, FEATURE_MATRIX, isAdvancedOnly, levelAllows, parseLevel, showsLevelSwitch } from "./level";

describe("level", () => {
  it("starts on Advanced and reads only the two known values", () => {
    expect(DEFAULT_LEVEL).toBe("advanced");
    expect(parseLevel("basic")).toBe("basic");
    expect(parseLevel("advanced")).toBe("advanced");
    for (const v of ["Basic", "", undefined, null, 3, "expert"]) expect(parseLevel(v)).toBe("advanced");
  });

  it("knows the advanced-only screens, including their sub-pages", () => {
    for (const p of ADVANCED_ONLY) {
      expect(isAdvancedOnly(p)).toBe(true);
      expect(isAdvancedOnly(`${p}/abc`)).toBe(true);
    }
    expect(isAdvancedOnly("/tenders-archive")).toBe(false);
    for (const p of ["/dashboard", "/finance", "/inventory", "/company-profile", "/sales-force", "/imports", "/history", "/settings", "/opportunities"]) expect(isAdvancedOnly(p)).toBe(false);
  });

  it("hides advanced-only screens on Basic from people with the business screens, never from departments", () => {
    for (const role of ["owner", "admin", "viewer"] as const) {
      expect(levelAllows("basic", role, "/service")).toBe(false);
      expect(levelAllows("basic", role, "/tenders/x")).toBe(false);
      expect(levelAllows("basic", role, "/finance")).toBe(true);
      expect(levelAllows("advanced", role, "/service")).toBe(true);
    }
    for (const role of ["tender", "finance"] as const) expect(levelAllows("basic", role, "/tenders")).toBe(true);
  });

  it("shows the switch only to people with the business screens", () => {
    expect(ROLES.filter(showsLevelSwitch)).toEqual(["owner", "admin", "viewer"]);
  });

  it("compares the two versions row by row", () => {
    expect(FEATURE_MATRIX.length).toBeGreaterThanOrEqual(8);
    for (const row of FEATURE_MATRIX) expect(row.every((c) => c.length > 0)).toBe(true);
  });
});
