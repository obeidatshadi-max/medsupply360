import { describe, expect, it } from "vitest";
import { accountHref, crumbFor, isCurrentItem, navItems } from "./nav";

type O = Parameters<typeof navItems>[0];
const labels = (o: O) => navItems(o).main.map((i) => i.label);
const OWNER: O = { guest: false, role: "owner" };

describe("navItems", () => {
  it("has one Data entry for the owner and administrators, and none for viewers, guests or departments", () => {
    for (const o of [OWNER, { guest: false, role: "admin" } as O]) expect(labels(o).filter((l) => l === "Data")).toHaveLength(1);
    for (const o of [{ guest: false, role: "viewer" }, { guest: true, role: "owner" }, { guest: false, role: "tender" }, { guest: false, role: "finance" }] as O[]) expect(labels(o)).not.toContain("Data");
    for (const o of [OWNER, { guest: false, role: "admin" } as O]) {
      expect(labels(o)).not.toContain("Data & update routine");
      expect(labels(o)).not.toContain("Compare versions");
    }
  });

  it("sends the owner to the data channels and administrators to the update history", () => {
    const pick = (o: O) => navItems(o).main.find((i) => i.label === "Data")!;
    expect(pick(OWNER).href).toBe("/imports");
    expect(pick({ guest: false, role: "admin" }).href).toBe("/history");
  });

  it("has no greyed-out placeholder left in the main menu", () => {
    expect(navItems(OWNER).main.every((i) => i.href)).toBe(true);
  });

  it("lists the demo's five EXPLORE screens first; all five are built", () => {
    for (const o of [OWNER, { guest: false, role: "admin" } as O, { guest: true, role: "viewer" } as O]) {
      const explore = navItems(o).explore;
      expect(explore.slice(0, 5).map((i) => i.label)).toEqual(["Company profile", "Installed base", "Service & support", "Support functions", "Opportunity radar"]);
      expect(explore.slice(0, 5).filter((i) => i.href).map((i) => i.href)).toEqual(["/company-profile", "/installed-base", "/service", "/support-functions", "/opportunity-radar"]);
    }
    expect(navItems({ guest: false, role: "tender" }).explore).toEqual([]);
  });

  it("names the data pages as part of Data in the breadcrumb", () => {
    const { main } = navItems(OWNER);
    expect(crumbFor("/imports/erp", main)).toBe("Data");
    expect(crumbFor("/imports", main)).toBe("Data");
    expect(crumbFor("/history", main)).toBe("Data");
  });

  it("shows the Sales force to the owner and administrators only, right after Sales & accounts", () => {
    for (const role of ["owner", "admin"] as const) {
      const l = labels({ guest: false, role });
      expect(l).toContain("Sales force");
      expect(l.indexOf("Sales force")).toBe(l.indexOf("Sales & accounts") + 1);
    }
    for (const o of [{ guest: false, role: "viewer" }, { guest: true, role: "owner" }, { guest: false, role: "tender" }, { guest: false, role: "finance" }] as O[]) expect(labels(o)).not.toContain("Sales force");
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

describe("Basic and Advanced", () => {
  const hrefs = (o: O) => [...navItems(o).main, ...navItems(o).explore].flatMap((i) => (i.href ? [i.href] : []));
  const ADV = ["/tenders", "/installed-base", "/service", "/support-functions", "/opportunity-radar"];

  it("lists every screen on Advanced, and starts on Advanced", () => {
    for (const level of [undefined, "advanced"] as const) for (const href of ADV) expect(hrefs({ ...OWNER, level })).toContain(href);
  });

  it("leaves the Advanced-only screens out of the menu on Basic, keeping the rest", () => {
    const basic = hrefs({ ...OWNER, level: "basic" });
    for (const href of ADV) expect(basic).not.toContain(href);
    for (const href of ["/dashboard", "/finance", "/inventory", "/company-profile", "/sales-force", "/opportunities", "/imports", "/settings"]) expect(basic).toContain(href);
  });

  it("never takes the tender section away from a department", () => {
    for (const role of ["tender", "finance"] as const) expect(hrefs({ guest: false, role, level: "basic" })).toEqual(["/tenders"]);
  });
});

describe("sample entries", () => {
  it("shows Sample tenders to guests and to business users, and Sample data to signed-in users only", () => {
    const explore = (o: O) => navItems(o).explore.map((i) => i.label).filter((l) => l.startsWith("Sample"));
    expect(explore({ guest: true, role: "viewer" })).toEqual(["Sample tenders"]);
    expect(explore(OWNER)).toEqual(["Sample data", "Sample tenders"]);
  });

  it("highlights only one sample item at a time", () => {
    const [data, tenders] = navItems(OWNER).explore.filter((i) => i.label.startsWith("Sample"));
    expect(isCurrentItem("/sample/tenders", tenders!)).toBe(true);
    expect(isCurrentItem("/sample/tenders", data!)).toBe(false);
    expect(isCurrentItem("/sample", data!)).toBe(true);
    expect(isCurrentItem("/sample/accounts/all", data!)).toBe(true);
    expect(crumbFor("/sample/tenders", [...navItems(OWNER).main, ...navItems(OWNER).explore])).toBe("Sample tenders");
  });
});

describe("accountHref", () => {
  it("opens the Accounts page searched by customer code, escaping what needs it", () => {
    expect(accountHref("C1")).toBe("/accounts/all?q=C1");
    expect(accountHref("A&B 7/x")).toBe("/accounts/all?q=A%26B%207%2Fx");
  });
});
