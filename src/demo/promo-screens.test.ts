import { describe, expect, it } from "vitest";
import { ASSIGNABLE_ROLES, ROLES, ROLE_LABEL } from "@/core/permissions";
import { demoFreshness, freshnessHtml } from "./freshness-demo";
import { demoHistory, historyCsvRows, historyHtml } from "./history-screen";
import { DEMO_PEOPLE, settingsCsvRows, settingsHtml } from "./settings-screen";
import { DEMO_SALES_FORCE, assigneeOf, productAssignHtml, salesForceCsvRows, salesForceHtml, salesPersonHtml } from "./sales-force-demo";
import { DEMO_STAFF, DEMO_TENDERS } from "./tender-demo";
import { targetProgress } from "@/core/sales-force";

describe("demo Settings", () => {
  it("lists every sample person and every access level", () => {
    const html = settingsHtml();
    for (const p of DEMO_PEOPLE) expect(html).toContain(p.name);
    for (const r of ROLES) expect(html).toContain(ROLE_LABEL[r].name);
    expect(settingsCsvRows()).toHaveLength(DEMO_PEOPLE.length + 1);
  });

  it("shows the add-person form with every assignable access level", () => {
    const html = settingsHtml();
    expect(html).toContain("Add a person");
    for (const r of ASSIGNABLE_ROLES) expect(html).toContain(`value="${r}"`);
    expect(html).not.toContain(`value="owner"`);
  });

  it("uses job titles, never real-looking names", () => {
    expect(DEMO_PEOPLE.every((p) => p.email.endsWith("@demo-company.example"))).toBe(true);
  });
});

describe("demo data freshness", () => {
  it("runs the app's rules: one aging and one stale file", () => {
    const f = demoFreshness();
    expect(f.level).toBe("stale");
    expect(f.items.find((i) => i.key === "cash")?.level).toBe("aging");
    expect(f.items.find((i) => i.key === "stock")?.level).toBe("stale");
    const html = freshnessHtml();
    expect(html).toContain("The data is out of date");
    expect(html).toContain("Stock");
  });
});

describe("demo update history", () => {
  it("lists newest first, each row with a typed name, its account and a time", () => {
    const rows = demoHistory();
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.map((r) => r.at)).toEqual([...rows.map((r) => r.at)].sort().reverse());
    for (const r of rows) {
      expect(r.at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
      expect(r.by.length).toBeGreaterThan(1);
      expect(r.account).toBeTruthy();
    }
  });

  it("shows several different people on the same shared department account", () => {
    const tender = new Set(demoHistory(200).filter((r) => r.account === "Tender Department").map((r) => r.by));
    expect(tender.size).toBeGreaterThan(1);
    for (const name of tender) expect(DEMO_STAFF[name]).toBe("Tender Department");
  });

  it("never lists anything after the demo's snapshot date and escapes the search", () => {
    expect(demoHistory(500).every((r) => r.at.slice(0, 10) <= "2026-10-08")).toBe(true);
    expect(historyHtml({ query: "<script>" })).not.toContain("<script>");
    expect(historyHtml({ query: "Lina" })).toContain("Lina Haddad");
    expect(historyCsvRows()).toHaveLength(demoHistory().length + 1);
  });
});

const PRODUCTS = [
  { name: "MEDIMA P300 volumetric infusion pump", manufacturer: "MEDIMA Sp. z o.o.", line: "Equipment" },
  { name: "BOWA single-use argon probes", manufacturer: "BOWA-electronic GmbH & Co. KG", line: "Consumables" },
  { name: "Vapotherm Precision Flow", manufacturer: "Vapotherm, Inc.", line: "Devices" },
  { name: "Somatics Thymatron System IV", manufacturer: "Somatics, LLC.", line: "Devices" },
];
const OPTS = { products: PRODUCTS, overrides: {}, generic: false };

describe("demo sales force", () => {
  it("lists every person with email, suppliers, expectations and sales against the target", () => {
    const html = salesForceHtml(OPTS);
    for (const p of DEMO_SALES_FORCE) {
      expect(html).toContain(p.name);
      expect(html).toContain(p.email);
    }
    expect(html).toContain("MEDIMA Sp. z o.o.");
    expect(html).toContain("Turned off");
    expect(salesForceCsvRows(OPTS)).toHaveLength(DEMO_SALES_FORCE.length + 1);
  });

  it("shows people on target, behind and well behind side by side", () => {
    const html = salesForceHtml(OPTS);
    for (const word of ["On target", "Behind", "Well behind"]) expect(html).toContain(word);
  });

  it("judges each person with the app's progress rule", () => {
    const khaled = salesPersonHtml("Khaled Mansour", OPTS)!;
    expect(khaled).toContain("Customer accounts (2)");
    expect(khaled).toContain("On target");
    expect(salesPersonHtml("Dina Abu-Zaid", OPTS)).toContain("Behind");
    expect(salesPersonHtml("Yousef Nasrallah", OPTS)).toContain("Well behind");
    expect(targetProgress(60_000, 10_000, "2026-06-30").status).toBe("on");
  });

  it("gives each product to the person who represents its supplier, and lets a choice override that", () => {
    expect(assigneeOf(PRODUCTS[0]!, {})).toBe("Khaled Mansour");
    expect(assigneeOf(PRODUCTS[3]!, {})).toBeNull();
    expect(assigneeOf(PRODUCTS[0]!, { [PRODUCTS[0]!.name]: "Dina Abu-Zaid" })).toBe("Dina Abu-Zaid");
    expect(assigneeOf(PRODUCTS[0]!, { [PRODUCTS[0]!.name]: "" })).toBeNull();
  });

  it("shows an assignment on the Sales force screen straight away", () => {
    const before = salesPersonHtml("Dina Abu-Zaid", OPTS)!;
    expect(before).not.toContain("MEDIMA P300");
    const after = salesPersonHtml("Dina Abu-Zaid", { ...OPTS, overrides: { [PRODUCTS[0]!.name]: "Dina Abu-Zaid" } })!;
    expect(after).toContain("MEDIMA P300");
    expect(after).toContain("Products (2)");
  });

  it("lists the tenders a person holds and links to them", () => {
    const html = salesPersonHtml("Khaled Mansour", OPTS)!;
    for (const t of DEMO_TENDERS.filter((x) => x.owner === "Khaled Mansour")) expect(html).toContain(`data-tender="${t.id}"`);
    expect(salesPersonHtml("Nobody", OPTS)).toBeNull();
  });

  it("offers a quick-assign list grouped by supplier, with a whole-supplier shortcut and no turned-off person to choose", () => {
    const html = productAssignHtml(OPTS);
    expect(html).toContain("data-assign-supplier");
    expect(html).toContain("data-assign-product");
    for (const p of PRODUCTS) expect(html).toContain(p.name);
    const bulk = html.slice(html.indexOf("data-assign-supplier"), html.indexOf("</select>", html.indexOf("data-assign-supplier")));
    expect(bulk).not.toContain("Hani Tarawneh");
  });

  it("does not claim Sadaf's suppliers for another customer", () => {
    expect(productAssignHtml({ ...OPTS, generic: true })).toBe("");
    const html = salesForceHtml({ ...OPTS, generic: true });
    expect(html).not.toContain("MEDIMA");
  });

  it("escapes what it prints", () => {
    expect(salesForceHtml({ ...OPTS, query: "<script>" })).not.toContain("<script>");
    expect(productAssignHtml({ ...OPTS, query: "<script>" })).not.toContain("<script>");
  });
});

describe("demo cross-links", () => {
  it("names the holder of each demo account and nobody for an unheld one", async () => {
    const { accountHolder } = await import("./sales-force-demo");
    expect(accountHolder("T-01")).toBe("Khaled Mansour");
    expect(accountHolder("P-02")).toBe("Yousef Nasrallah");
    expect(accountHolder("NOPE")).toBeNull();
  });

  it("lets a person's account names open that account on the Sales & accounts screen", async () => {
    const { salesPersonHtml } = await import("./sales-force-demo");
    const html = salesPersonHtml("Khaled Mansour", { products: [], overrides: {}, generic: false })!;
    expect(html).toContain('data-goto-account="Jordan Valley Public Hospitals Group"');
  });
});
