import { describe, expect, it } from "vitest";
import { customerProfileStore, demoActionKey, normalizeCustomerProfile, profileDraftFromText } from "./customer-profiles";
import { checkDemoImport, currentAppTemplate, demoProductReorders, demoReadiness, SNAPSHOT_BAD_SAMPLE, SNAPSHOT_SAMPLE } from "./prediction-demo";
import { SPECS, type ImportKind } from "@/core/import/specs";

describe("customer profile context", () => {
  it("switches saved profiles and reloads the active customer while preserving the Sadaf preset", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } };
    const store = customerProfileStore(storage);
    const a = store.save({ name: "Atlas Medical", suppliers: ["Atlas supplier"] });
    const b = store.save({ name: "Beacon Medical", suppliers: ["Beacon supplier"] });
    expect(store.active().name).toBe("Beacon Medical");
    store.select(a.id);
    expect(customerProfileStore(storage).active()).toMatchObject({ name: "Atlas Medical", suppliers: ["Atlas supplier"] });
    expect(demoActionKey(a.id)).not.toBe(demoActionKey(b.id));
    expect(store.select("sadaf")).toMatchObject({ name: "Sadaf Medical Supplies", founded: "2008" });
  });
  it("keeps a working session when storage is unavailable and rejects incomplete profiles", () => {
    const store = customerProfileStore({ getItem() { throw Error("denied"); }, setItem() { throw Error("denied"); } });
    expect(store.save({ name: "Session clinic" }).name).toBe("Session clinic");
    expect(store.persistent()).toBe(false);
    expect(() => normalizeCustomerProfile({ name: " " }, "x")).toThrow(/company name/);
  });
  it("prepares reviewable facts without inventing financial records", () => {
    const draft = profileDraftFromText("Company name: Atlas Medical\nFounded: 2015\nERP: Example ERP\nSuppliers: Alpha; Beta\nCountry: Jordan");
    expect(draft).toMatchObject({ name: "Atlas Medical", founded: "2015", erp: "Example ERP", suppliers: ["Alpha", "Beta"], location: "Jordan" });
    expect(draft).not.toHaveProperty("revenue");
    expect(normalizeCustomerProfile({ ...draft, sales: 1000000 }, "x")).not.toHaveProperty("sales");
  });
});

describe("shared demo features", () => {
  it.each(Object.keys(SPECS) as ImportKind[])("generates a %s sample accepted by the current application parser", (kind) => {
    expect(checkDemoImport(kind, currentAppTemplate(kind))).toMatchObject({ fatal: null, blocked: false, readyRows: 1, rejected: [] });
  });
  it("shows a missed product cycle despite a recent order for another product", () => {
    const r = demoProductReorders();
    expect(r.items.find((x) => x.customerCode === "DEMO-C1")).toMatchObject({ productCode: "DEMO-P1", forecast: { expectedNext: "2026-08-29", level: "Overdue" } });
    expect(r.insufficientHistory).toBe(1);
    expect(r.items.every((x) => x.customerCode !== "DEMO-T1")).toBe(true);
  });
  it("blocks incomplete snapshots and ambiguous field aliases using the actual importer", () => {
    expect(checkDemoImport("stock_snapshot", SNAPSHOT_SAMPLE)).toMatchObject({ blocked: false, readyRows: 1 });
    expect(checkDemoImport("stock_snapshot", SNAPSHOT_BAD_SAMPLE)).toMatchObject({ blocked: true, readyRows: 0 });
    expect(checkDemoImport("products", "code,item code,name,line\nP1,P2,Sample,Consumables").fatal).toMatch(/Ambiguous columns/);
    expect(demoReadiness()).toHaveLength(8);
  });
});
