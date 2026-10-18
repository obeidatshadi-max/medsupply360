import { describe, expect, it } from "vitest";
import { crumbFor, navItems } from "./nav";

const labels = (o: Parameters<typeof navItems>[0]) => navItems(o).main.map((i) => i.label);

describe("navItems", () => {
  it("has one Alpha ERP data entry and no separate weekly or compare entries", () => {
    for (const o of [{ guest: false, owner: true }, { guest: false, owner: false }, { guest: true, owner: false }]) {
      expect(labels(o).filter((l) => l === "Alpha ERP data")).toHaveLength(1);
      expect(labels(o)).not.toContain("Data & update routine");
      expect(labels(o)).not.toContain("Compare versions");
    }
  });

  it("sends the owner to imports and everyone else to the weekly update", () => {
    const pick = (o: Parameters<typeof navItems>[0]) => navItems(o).main.find((i) => i.label === "Alpha ERP data")!;
    expect(pick({ guest: false, owner: true }).href).toBe("/imports");
    expect(pick({ guest: false, owner: false }).href).toBe("/weekly");
    expect(pick({ guest: true, owner: false }).href).toBe("/weekly");
  });

  it("links every main item except none left as a dead placeholder", () => {
    expect(navItems({ guest: false, owner: true }).main.every((i) => i.href)).toBe(true);
  });

  it("names the weekly page as part of Alpha ERP data in the breadcrumb", () => {
    const { main } = navItems({ guest: false, owner: true });
    expect(crumbFor("/weekly", main)).toBe("Alpha ERP data");
    expect(crumbFor("/imports", main)).toBe("Alpha ERP data");
  });
});
