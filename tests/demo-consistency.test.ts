/**
 * Guards the frozen promotional demo against drifting from the tested calculation core.
 * Loads demo/index.html in jsdom, renders every view in both versions and every line filter,
 * then checks the demo's data and displayed figures against src/core/calc.ts.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";
import * as c from "../src/core/calc";
import { DEMO_TENDERS, demoTenderOverview } from "../src/demo/tender-demo";
import { jod, pct } from "../src/lib/format";

const ASOF = "2026-10-08";
const html = readFileSync(fileURLToPath(new URL("../demo/index.html", import.meta.url)), "utf8");

type Win = Window & { eval: (code: string) => unknown };
let w: Win;
const jsErrors: string[] = [];

const data = () =>
  JSON.parse(w.eval("JSON.stringify({lines,units,stock,invoices,tenders})") as string) as {
    lines: { name: string; rev: number; gp: number; cost: number; col: number; rec: number }[];
    units: { id: string; line: string; expected: number; actual: number; profit: number }[];
    stock: { id: string; qty: number; value: number; months: number; expiry: string; loss: number }[];
    invoices: { account: string; value: number; due: string; days: number }[];
    tenders: { id: string; line: string; value: number; margin: number }[];
  };

const mainText = (mode: "basic" | "advanced", route: string, line = "All lines") => {
  w.eval(`state.mode='${mode}';state.line='${line}';state.query='';state.route='${route}';render()`);
  return (w.document.querySelector("#main")?.textContent ?? "").replace(/\s+/g, " ");
};

beforeAll(() => {
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => jsErrors.push(String(e.message)));
  w = new JSDOM(html, { runScripts: "dangerously", url: "https://demo.test/", virtualConsole: vc }).window as unknown as Win;
});

describe("demo renders", () => {
  it("every view, both versions, every line filter, without a script error", () => {
    const routes = w.eval("routes.map(r=>r[0])") as string[];
    const basic = w.eval("basicRoutes") as string[];
    const failures: string[] = [];
    for (const mode of ["basic", "advanced"] as const)
      for (const line of ["All lines", "Equipment", "Devices", "Consumables"])
        for (const route of routes) {
          if (mode === "basic" && !basic.includes(route)) continue;
          try {
            mainText(mode, route, line);
          } catch (e) {
            failures.push(`${mode}/${line}/${route}: ${(e as Error).message}`);
          }
        }
    expect(failures).toEqual([]);
    expect(jsErrors).toEqual([]);
  });
});

describe("demo data agrees with the calculation core", () => {
  it("overdue days come from contractual due dates", () => {
    for (const i of data().invoices) expect(i.days).toBe(c.daysOverdue(i.value, i.due, ASOF));
  });
  it("expiry loss equals the core formula", () => {
    for (const s of data().stock) {
      const expected = c.isIsoDate(s.expiry)
        ? c.expiryLoss(c.unsoldAtExpiry(s.qty, c.dailyIssuesFromCover(s.qty, s.months), s.expiry, ASOF), s.value / s.qty)
        : 0; // equipment and devices have no expiry
      expect(s.loss, s.id).toBe(Math.round(expected));
    }
  });
  it("stock is valued at cost: SKU-530 uses 1.8 per piece, as in its own sales example", () => {
    expect(data().stock.find((s) => s.id === "SKU-530")!.value).toBe(c.stockValue(2477, 1.8));
  });
  it("business lines are internally consistent", () => {
    const { lines } = data();
    for (const l of lines) {
      expect(l.gp).toBeLessThan(l.rev);
      expect(l.cost).toBeLessThan(l.gp);
      expect(l.col).toBeLessThanOrEqual(l.rev);
      expect(l.rec).toBeLessThanOrEqual(l.rev);
    }
    expect(lines.reduce((a, l) => a + l.rev, 0)).toBe(4_540_013);
  });
  it("annual consumable contribution = actual monthly purchases x 12 x 30%", () => {
    for (const u of data().units) expect(u.profit, u.id).toBe(Math.round(c.roundJod(u.actual * 12 * 0.3)));
  });
  it("tender cost splits add back to the contract value", () => {
    const { tenders, lines } = data();
    for (const t of tenders) {
      const l = lines.find((x) => x.name === t.line)!;
      const s = c.tenderCostSplit(t.value, l.gp / l.rev, t.margin / 100);
      expect(s.productCost + s.fulfillment + s.contribution, t.id).toBeCloseTo(t.value, 2);
      expect(s.fulfillment, t.id).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("demo displays what the core calculates", () => {
  it("overdue total and aging reconcile", () => {
    const { invoices } = data();
    const aging = c.receivablesAging(invoices.map((i) => ({ outstanding: i.value, dueDate: i.due })), ASOF);
    expect(aging.overdue).toBe(117_067);
    expect(mainText("basic", "overview")).toContain("JOD 117.1K");
  });
  it("expiry exposure shown equals the core total on every screen that shows it", () => {
    const total = data().stock.reduce((a, s) => a + s.loss, 0);
    expect(total).toBe(21_760);
    expect(mainText("basic", "overview")).toContain("JOD 21,760");
    expect(mainText("advanced", "overview")).toContain("JOD 21.8K");
    expect(mainText("advanced", "inventory")).toContain("JOD 21,760");
  });
  it("recurring capture and gap match the core", () => {
    const { units } = data();
    const exp = units.reduce((a, u) => a + u.expected, 0);
    const act = units.reduce((a, u) => a + u.actual, 0);
    const text = mainText("advanced", "overview");
    expect(text).toContain(`${Math.round((act / exp) * 100)}%`);
    expect(text).toContain(`JOD ${(exp - act).toLocaleString("en-US")} / month`);
    expect(c.purchaseGap({ activityCount: exp, consumablesPerActivity: 1, referencePrice: 1, purchasedQty: act }).gap).toBe(exp - act);
  });
  it("collection alert uses the derived overdue days", () => {
    const { invoices } = data();
    expect(mainText("advanced", "overview")).toContain(`${invoices[0]!.days} days overdue`);
    expect(invoices[0]!.days).toBe(112);
  });
  it("standalone consumable sales = consumable revenue - recurring", () => {
    const l = data().lines.find((x) => x.name === "Consumables")!;
    expect(l.rev - l.rec).toBe(490_755);
    expect(mainText("advanced", "sales")).toContain("JOD 490.8K");
  });
  it("tenders show the app's sample tenders with the same overview figures", () => {
    const o = demoTenderOverview();
    const text = mainText("advanced", "tenders");
    for (const k of [jod(o.payments.unpaid), jod(o.guarantees.active), `Win rate: ${pct(o.results.winRate!)}`, ...DEMO_TENDERS.map((t) => t.title)]) expect(text, k).toContain(k);
    (w.document.querySelector('[data-tender="d8"]') as HTMLElement).click();
    const drawer = (w.document.querySelector("#detail")?.textContent ?? "").replace(/\s+/g, " ");
    expect(drawer).toContain("INV-2026-0433");
    expect(drawer).toContain(`still unpaid ${jod(355660)}`);
    w.eval("close()");
    expect(jsErrors).toEqual([]);
  });
  it("names the period instead of 'this year' on every screen", () => {
    const routes = w.eval("routes.map(r=>r[0])") as string[];
    for (const route of routes) expect(mainText("advanced", route), route).not.toMatch(/this year/i);
    for (const view of ["all", "tender", "private"]) {
      w.eval(`state.acctView='${view}'`);
      expect(mainText("advanced", "sales"), view).not.toMatch(/this year/i);
    }
  });
  it("money formatter never prints 1000.0K", () => {
    expect(w.eval("short(999999)")).toBe("JOD 1.00M");
    expect(w.eval("short(999949)")).toBe("JOD 999.9K");
  });
});
