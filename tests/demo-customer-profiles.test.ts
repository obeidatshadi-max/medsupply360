import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const html = readFileSync(fileURLToPath(new URL("../demo/index.html", import.meta.url)), "utf8");
const windows: JSDOM[] = [];
const setup = () => {
  const errors: string[] = [], console = new VirtualConsole();
  console.on("jsdomError", (e) => errors.push(e.message));
  const dom = new JSDOM(html, { url: "https://customer-demo.test/", runScripts: "dangerously", virtualConsole: console,
    beforeParse(w) { w.scrollTo = () => {}; } });
  windows.push(dom);
  return { w: dom.window, errors };
};
afterEach(() => { for (const dom of windows.splice(0)) dom.window.close(); });

function saveCustomer(w: JSDOM["window"], name: string, supplier = "Example supplier", erp = "Example ERP") {
  (w.document.querySelector("#customer-switch") as HTMLButtonElement).click();
  (w.document.querySelector("#profile-new") as HTMLButtonElement).click();
  for (const [key, value] of Object.entries({ name, suppliers: supplier, erp, location: "Jordan", source: "Presenter-reviewed profile" })) {
    (w.document.querySelector(`#profile-${key}`) as HTMLInputElement).value = value;
  }
  const form = w.document.querySelector("#profile-form")!;
  const button = form.querySelector('button[value="new"]')!;
  form.dispatchEvent(new w.SubmitEvent("submit", { bubbles: true, cancelable: true, submitter: button as HTMLButtonElement }));
}
const route = (w: JSDOM["window"], name: string) => w.eval(`state.mode='advanced';state.route=${JSON.stringify(name)};state.query='';render()`);

describe("tailored customer demonstration", () => {
  it("discards pending CSV checks when the presenter switches customers", async () => {
    const { w, errors } = setup();
    saveCustomer(w, "Atlas Medical");
    route(w, "chan-erp");
    const complete: ((value: string) => void)[] = [];
    for (const selector of ["#app-import-file", "#csvFile"]) {
      const input = w.document.querySelector(selector)!;
      const text = new Promise<string>((resolve) => complete.push(resolve));
      Object.defineProperty(input, "files", { value: [{ name: "Atlas-private.csv", size: 100, text: () => text }] });
      input.dispatchEvent(new w.Event("change", { bubbles: true }));
    }
    saveCustomer(w, "Beacon Medical");
    route(w, "chan-erp");
    for (const resolve of complete) resolve("Atlas confidential header\nx");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(w.document.querySelector("#app-import-result")!.textContent).toBe("");
    expect(w.document.querySelector("#validation")!.textContent).toBe("");
    expect(errors).toEqual([]);
  });
  it("personalizes the workspace and prevents the previous customer's supplier/product context leaking into a new one", () => {
    const { w, errors } = setup();
    saveCustomer(w, "Atlas Medical", "Atlas supplier");
    expect(w.document.title).toContain("Atlas Medical");
    expect(w.document.querySelector(".demo-banner")!.textContent).toContain("Atlas Medical");
    for (const name of ["company", "catalog", "base", "inventory", "finance", "actions", "data", "alpha", "chan-erp", "chan-tender", "chan-manual"]) {
      route(w, name);
      const content = w.document.querySelector("#main")!.cloneNode(true) as HTMLElement;
      content.querySelector("#customer-picker")?.remove(); // The switcher intentionally lists saved customers.
      const text = content.textContent!;
      expect(text, name).not.toContain("Sadaf Medical");
      expect(text, name).not.toContain("MEDIMA");
      expect(text, name).not.toContain("Vapotherm");
    }
    route(w, "catalog");
    expect(w.document.querySelector("#main")!.textContent).toContain("Atlas supplier");
    expect(w.document.querySelectorAll('#main a[href^="https://www.medima"]')).toHaveLength(0);
    expect(errors).toEqual([]);
  });
  it("isolates action history between customer profiles and restores the original Sadaf facts", () => {
    const { w, errors } = setup();
    saveCustomer(w, "Atlas Medical");
    const atlas = String(w.eval("customerDemo.profile().id"));
    w.eval("tasks[0].title='Atlas follow-up only';persist()");
    saveCustomer(w, "Beacon Medical", "Beacon supplier");
    expect(w.eval("tasks.map(t=>t.title).join(' ')")).not.toContain("Atlas follow-up only");
    const select = w.document.querySelector("#customer-picker") as HTMLSelectElement;
    select.value = atlas; select.dispatchEvent(new w.Event("change", { bubbles: true }));
    expect(w.eval("tasks[0].title")).toBe("Atlas follow-up only");
    (w.document.querySelector("#profile-sadaf") as HTMLButtonElement).click();
    expect(w.document.querySelector("#main")!.textContent).toContain("Organization in the 2022 profile");
    expect(w.document.querySelector("#main")!.textContent).toContain("Scanlan Group");
    expect(errors).toEqual([]);
  });
  it("escapes profile content in the company heading, ERP navigation and supplier tables", () => {
    const { w } = setup();
    saveCustomer(w, '<img src=x onerror="window.profileInjected=true">', '<svg onload="window.profileInjected=true">', '<img src=x onerror="window.profileInjected=true">');
    for (const name of ["catalog", "inventory", "alpha", "chan-erp", "chan-manual", "company"]) route(w, name);
    expect(w.document.querySelector("#main img")).toBeNull();
    expect(w.document.querySelector("#nav img")).toBeNull();
    expect(w.eval("window.profileInjected")).toBeUndefined();
  });
  it("demonstrates atomic snapshot rejection, readiness and product reorder parity", () => {
    const { w, errors } = setup();
    route(w, "chan-erp");
    (w.document.querySelector("#snapshot-bad") as HTMLButtonElement).click();
    expect(w.document.querySelector("#app-import-result")!.textContent).toContain("Replacement blocked");
    expect(w.document.querySelector("#snapshot-value")!.textContent).toContain("10 units");
    (w.document.querySelector("#snapshot-good") as HTMLButtonElement).click();
    expect(w.document.querySelector("#snapshot-value")!.textContent).toContain("20 units");
    (w.document.querySelector("#snapshot-bad") as HTMLButtonElement).click();
    expect(w.document.querySelector("#snapshot-value")!.textContent).toContain("20 units");
    route(w, "data"); expect(w.document.querySelector("#main")!.textContent).toContain("Data for predictions");
    route(w, "actions"); expect(w.document.querySelector("#main")!.textContent).toContain("Repeat consumables by customer and product");
    expect(errors).toEqual([]);
  });
});
