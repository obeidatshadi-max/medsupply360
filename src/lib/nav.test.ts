import { describe, expect, it } from "vitest";
import { crumbFor, navItems } from "./nav";

type O = Parameters<typeof navItems>[0];
const labels = (o: O) => navItems(o).main.map((i) => i.label);
const OWNER: O = { guest: false, role: "owner" };

describe("navItems", () => {
  it("has one Alpha ERP data entry and no separate weekly or compare entries", () => {
    for (const o of [OWNER, { guest: false, role: "viewer" } as O, { guest: true, role: "viewer" } as O, { guest: false, role: "admin" } as O]) {
      expect(labels(o).filter((l) => l === "Alpha ERP data")).toHaveLength(1);
      expect(labels(o)).not.toContain("Data & update routine");
      expect(labels(o)).not.toContain("Compare versions");
    }
  });

  it("sends the owner to imports and everyone else to the weekly update", () => {
    const pick = (o: O) => navItems(o).main.find((i) => i.label === "Alpha ERP data")!;
    expect(pick(OWNER).href).toBe("/imports");
    expect(pick({ guest: false, role: "viewer" }).href).toBe("/weekly");
    expect(pick({ guest: true, role: "viewer" }).href).toBe("/weekly");
  });

  it("has no greyed-out placeholder left in the main menu", () => {
    expect(navItems(OWNER).main.every((i) => i.href)).toBe(true);
  });

  it("names the weekly page as part of Alpha ERP data in the breadcrumb", () => {
    const { main } = navItems(OWNER);
    expect(crumbFor("/weekly", main)).toBe("Alpha ERP data");
    expect(crumbFor("/imports", main)).toBe("Alpha ERP data");
  });

  it("shows department users the tender section only", () => {
    for (const role of ["tender", "finance"] as const) {
      expect(labels({ guest: false, role })).toEqual(["Tenders"]);
      expect(navItems({ guest: false, role }).explore).toEqual([]);
    }
  });

  it("shows Settings to the owner only and Tenders to owner and administrator", () => {
    expect(labels(OWNER)).toEqual(expect.arrayContaining(["Tenders", "Settings"]));
    expect(labels({ guest: false, role: "admin" })).toContain("Tenders");
    expect(labels({ guest: false, role: "admin" })).not.toContain("Settings");
    expect(labels({ guest: false, role: "viewer" })).not.toContain("Tenders");
    expect(labels({ guest: true, role: "viewer" })).not.toContain("Settings");
  });
});
