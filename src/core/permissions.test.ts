import { describe, expect, it } from "vitest";
import { ASSIGNABLE_ROLES, ROLES, canAccess, homePath, isAssignableRole } from "./permissions";

describe("permissions", () => {
  it("lets the owner open everything", () => {
    for (const area of ["business", "tender", "settings"] as const) expect(canAccess("owner", area)).toBe(true);
  });

  it("keeps department roles inside the tender section", () => {
    for (const role of ["tender", "finance"] as const) {
      expect(canAccess(role, "tender")).toBe(true);
      expect(canAccess(role, "business")).toBe(false);
      expect(canAccess(role, "settings")).toBe(false);
    }
  });

  it("keeps the tender section away from viewers and Settings away from everyone but the owner", () => {
    expect(canAccess("viewer", "tender")).toBe(false);
    for (const role of ROLES.filter((r) => r !== "owner")) expect(canAccess(role, "settings")).toBe(false);
  });

  it("sends each role to a page it may open", () => {
    expect(homePath("owner")).toBe("/dashboard");
    expect(homePath("viewer")).toBe("/dashboard");
    expect(homePath("tender")).toBe("/tenders");
    expect(homePath("finance")).toBe("/tenders");
  });

  it("never lets Settings hand out the owner role", () => {
    expect(ASSIGNABLE_ROLES).not.toContain("owner");
    expect(isAssignableRole("owner")).toBe(false);
    expect(isAssignableRole("tender")).toBe(true);
    expect(isAssignableRole("root")).toBe(false);
  });
});
