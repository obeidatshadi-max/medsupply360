/**
 * The demo explains terms the same way as the app: an (i) button beside a few terms that opens a short explanation with "Learn more",
 * a "Learn more" section in the terms list, and "what this may mean and what to do" under each attention item.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";
import { glossaryEntry } from "../src/core/glossary";

const html = readFileSync(fileURLToPath(new URL("../demo/index.html", import.meta.url)), "utf8");
type Win = Window & { eval: (code: string) => unknown; MouseEvent: typeof MouseEvent; KeyboardEvent: typeof KeyboardEvent };
let w: Win;
const errors: string[] = [];

const show = (mode: "basic" | "advanced", route: string) => w.eval(`state.mode='${mode}';state.line='All lines';state.query='';state.route='${route}';render()`);
const doc = () => w.document;
const click = (el: Element) => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));

beforeAll(() => {
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push(String(e.message)));
  w = new JSDOM(html, { runScripts: "dangerously", url: "https://demo.test/", virtualConsole: vc }).window as unknown as Win;
});

describe("demo term hints", () => {
  it("shows (i) buttons that are closed and named, on the finance screen", () => {
    show("advanced", "finance");
    const b = [...doc().querySelectorAll<HTMLButtonElement>(".tipb")];
    expect(b.length).toBeGreaterThan(0);
    for (const x of b) {
      expect(x.getAttribute("aria-expanded")).toBe("false");
      expect(x.getAttribute("aria-label")).toMatch(/^What does .+ mean\?$/);
      expect(glossaryEntry(x.dataset.tip!)).toBeDefined();
    }
  });

  it("opens a panel linked to the button, fits Learn more, and closes on Escape with focus back", () => {
    show("advanced", "finance");
    const b = doc().querySelector<HTMLButtonElement>('.tipb[data-tip="Aging"]')!;
    expect(b).toBeTruthy();
    click(b);
    expect(b.getAttribute("aria-expanded")).toBe("true");
    const panel = doc().getElementById(b.getAttribute("aria-controls")!)!;
    expect(panel.textContent).toContain(glossaryEntry("Aging")!.short);
    const more = panel.querySelector<HTMLButtonElement>(".tipmore")!;
    const deep = doc().getElementById(more.getAttribute("aria-controls")!)!;
    expect(deep.hidden).toBe(true);
    click(more);
    expect(deep.hidden).toBe(false);
    expect(deep.textContent).toContain("Why it matters:");
    expect(more.textContent).toBe("Show less");
    b.focus();
    doc().dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(doc().querySelector(".tipp")).toBeNull();
    expect(b.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes when the user taps outside, and only one panel is open at a time", () => {
    show("advanced", "tenders");
    const [a, b] = [...doc().querySelectorAll<HTMLButtonElement>(".tipb")];
    expect(b).toBeTruthy();
    click(a);
    click(b);
    expect(doc().querySelectorAll(".tipp").length).toBe(1);
    click(doc().body);
    expect(doc().querySelectorAll(".tipp").length).toBe(0);
  });
});

describe("demo terms list and attention items", () => {
  it("has a Learn more section for terms that have one", () => {
    show("advanced", "finance");
    const more = [...doc().querySelectorAll(".gloss-more summary")].map((x) => x.textContent);
    expect(more).toContain("Learn more about Aging");
    expect(more).toContain("Learn more about Overdue");
  });

  it("explains each attention item on the overview: what it may mean, why it matters, what to do", () => {
    show("advanced", "overview");
    const why = [...doc().querySelectorAll(".ob-flag .ob-why")];
    expect(why.length).toBeGreaterThan(0);
    for (const d of why) {
      expect(d.textContent).toContain("What it may mean:");
      expect(d.textContent).toContain("Why it matters:");
      expect(d.textContent).toContain("What to do next:");
      expect(d.textContent).not.toMatch(/\bbecause\b/i);
    }
  });

  it("raised no script errors", () => {
    expect(errors).toEqual([]);
  });
});
