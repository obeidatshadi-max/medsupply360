/**
 * The promotional demo's Sales & accounts view, rendered in jsdom, against the same numbers the app shows.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";
import { bundle, embed } from "../scripts/build-demo.mjs";

const html = readFileSync(fileURLToPath(new URL("../demo/index.html", import.meta.url)), "utf8");
type Win = Window & { eval: (code: string) => unknown };
let w: Win;
const errors: string[] = [];

const text = (mode: "basic" | "advanced", route: string, acct?: string) => {
  w.eval(`state.mode='${mode}';state.line='All lines';state.query='';state.route='${route}';${acct ? `state.acctView='${acct}';` : ""}render()`);
  return (w.document.querySelector("#main")?.textContent ?? "").replace(/\s+/g, " ");
};

beforeAll(() => {
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push(String(e.message)));
  w = new JSDOM(html, { runScripts: "dangerously", url: "https://demo.test/", virtualConsole: vc }).window as unknown as Win;
});

describe("demo bundle", () => {
  it("is exactly what the current source compiles to (run `npm run demo:build` if this fails)", async () => {
    expect(embed(html, await bundle())).toBe(html);
  });
});

describe("demo Sales & accounts (Advanced)", () => {
  it("all accounts: tender versus private side by side, adding up to the company", () => {
    const t = text("advanced", "sales", "all");
    for (const k of ["Tender accounts versus private accounts", "JOD 2.53M", "JOD 2.01M", "JOD 4.54M", "JOD 714.1K", "JOD 795.9K", "28.2%", "39.7%", "JOD 560.3K", "JOD 114.8K", "Invoice 112 days overdue", "2 at risk"])
      expect(t, k).toContain(k);
  });
  it("tender accounts: pipeline, backlog, collections, register and win rate", () => {
    const t = text("advanced", "sales", "tender");
    for (const k of ["Tender register", "JOD 441.2K", "JOD 249.5K", "JOD 99.3K", "54.5%", "Tender deadline in 10 days", "TN-061", "Performance bond", "Eastern Badia Regional Medical Center"]) expect(t, k).toContain(k);
    expect(t).not.toContain("Rawabi Wound and Diabetes Clinic");
  });
  it("private accounts: recurring capture, contracts, order rhythm, quiet accounts", () => {
    const t = text("advanced", "sales", "private");
    for (const k of ["64%", "3 of 4", "No order for 55 days", "Invoice 94 days overdue", "JOD 4,672"]) expect(t, k).toContain(k);
    expect(t).not.toContain("Jabal Amman University Hospital");
  });
  it("search narrows the account table without breaking the totals", () => {
    text("advanced", "sales", "all");
    w.eval("state.query='Irbid Al-Wasl Surgical Center';render()");
    const table = [...w.document.querySelectorAll("#main table")].find((t) => t.textContent?.includes("Credit used"))!;
    const rows = table.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("Irbid Al-Wasl Surgical Center");
    expect(rows[1].textContent).toContain("JOD 631.1K");
    expect(rows[1].textContent).toContain("JOD 42.4K");
    expect(rows[1].textContent).not.toContain("JOD 4.54M");
    const main = w.document.querySelector("#main")!.textContent!;
    expect(main).toContain("Filtered accounts");
    expect(main).toContain("1 account");
    w.eval("state.query='no such customer';render()");
    const empty = [...w.document.querySelectorAll("#main table")].find((t) => t.textContent?.includes("Credit used"))!;
    expect(empty.textContent).toContain("0 accounts");
    expect(empty.textContent).not.toContain("JOD 4.54M");
    w.eval("state.query=''");
  });
  it("export carries one row per account in the selected view", () => {
    const rows = w.eval("window.SadafAccounts.viewRows('tender').length") as number;
    expect(rows).toBe(4);
  });
});

describe("demo Sales & accounts (Basic)", () => {
  it("shows a compact tender versus private table under the line table", () => {
    const t = text("basic", "sales");
    for (const k of ["Tender versus private accounts", "JOD 2.53M", "JOD 2.01M", "JOD 4.54M", "28.2%", "39.7%"]) expect(t, k).toContain(k);
  });
});

it("no script errors", () => expect(errors).toEqual([]));
