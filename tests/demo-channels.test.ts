import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const html = readFileSync(fileURLToPath(new URL("../demo/index.html", import.meta.url)), "utf8");
const windows: JSDOM[] = [];
const setup = () => {
  const errors: string[] = [], console = new VirtualConsole();
  console.on("jsdomError", (e) => errors.push(e.message));
  const dom = new JSDOM(html, { url: "https://customer-demo.test/", runScripts: "dangerously", virtualConsole: console, beforeParse(w) { w.scrollTo = () => {}; } });
  windows.push(dom);
  return { w: dom.window, errors };
};
afterEach(() => { for (const dom of windows.splice(0)) dom.window.close(); });
const route = (w: JSDOM["window"], name: string) => w.eval(`state.mode='advanced';state.route=${JSON.stringify(name)};state.query='';render()`);

describe("demo Data section", () => {
  it("opens on the three channels and leads into each one", () => {
    const { w, errors } = setup();
    route(w, "alpha");
    const main = w.document.querySelector("#main")!;
    for (const t of ["ERP system", "Tender department", "Manual entry"]) expect(main.textContent).toContain(t);
    (main.querySelector('[data-route="chan-manual"]') as HTMLButtonElement).click();
    expect(w.document.querySelector("#crumb")!.textContent).toBe("Manual entry");
    expect(w.document.querySelector('nav[aria-label="Data"] [aria-current="page"]')!.textContent).toBe("Data channels");
    expect(errors).toEqual([]);
  });

  it("previews the sample workbook and saves nothing on confirm", () => {
    const { w, errors } = setup();
    route(w, "chan-manual");
    (w.document.querySelector("#chanSample") as HTMLButtonElement).click();
    expect(w.document.querySelector("#chanPreview")!.textContent).toContain("Installed equipment");
    (w.document.querySelector("#chanConfirm") as HTMLButtonElement).click();
    expect(w.document.body.textContent).toContain("nothing was saved");
    expect(errors).toEqual([]);
  });

  it("keeps the ERP validation tools on the ERP channel and the sidebar says Data", () => {
    const { w, errors } = setup();
    route(w, "chan-erp");
    expect(w.document.querySelector("#csvFile")).not.toBeNull();
    expect(w.document.querySelector("#nav")!.textContent).toContain("Data");
    expect(w.document.querySelector("#nav")!.textContent).not.toContain("Alpha ERP data");
    expect(errors).toEqual([]);
  });
});
