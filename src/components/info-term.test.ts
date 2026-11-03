// @vitest-environment jsdom
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { InfoTerm } from "./info-term";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement | null = null;
afterEach(() => {
  host?.remove();
  host = null;
});

function mount(node: React.ReactElement) {
  host = document.createElement("div");
  document.body.appendChild(host);
  act(() => createRoot(host!).render(node));
  return host;
}
const button = (h: HTMLElement) => h.querySelector<HTMLButtonElement>("button[aria-label^='What does']")!;

describe("InfoTerm", () => {
  it("renders the label and a closed (i) button that names the term", () => {
    const html = renderToStaticMarkup(createElement(InfoTerm, { term: "Overdue" }));
    expect(html).toContain("Overdue");
    expect(html).toContain('aria-label="What does Overdue mean?"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('<button type="button"');
    expect(html).not.toContain("Not paid after the due date");
  });

  it("shows other wording as the visible label when children are given", () => {
    const html = renderToStaticMarkup(createElement(InfoTerm, { term: "Aging" }, "Unpaid invoices by age"));
    expect(html).toContain("Unpaid invoices by age");
    expect(html).toContain("What does Aging mean?");
  });

  it("opens on click, links the button to the panel, and closes on Escape with focus back on the button", () => {
    const h = mount(createElement(InfoTerm, { term: "Overdue" }));
    const b = button(h);
    act(() => b.click());
    expect(b.getAttribute("aria-expanded")).toBe("true");
    const panel = document.getElementById(b.getAttribute("aria-controls")!)!;
    expect(panel.textContent).toContain("Not paid after the due date.");
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(b.getAttribute("aria-expanded")).toBe("false");
    expect(h.textContent).not.toContain("Not paid after the due date.");
    expect(document.activeElement).toBe(b);
  });

  it("closes when the user taps outside", () => {
    const h = mount(createElement(InfoTerm, { term: "Overdue" }));
    act(() => button(h).click());
    act(() => {
      document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(button(h).getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps Learn more hidden until it is asked for, and then shows example, reason and action", () => {
    const h = mount(createElement(InfoTerm, { term: "Stock cover" }));
    act(() => button(h).click());
    const more = [...h.querySelectorAll("button")].find((x) => x.textContent === "Learn more")!;
    expect(more.getAttribute("aria-expanded")).toBe("false");
    const region = document.getElementById(more.getAttribute("aria-controls")!)!;
    expect(region.className).toContain("hidden");
    act(() => more.click());
    expect(more.textContent).toBe("Show less");
    expect(region.className).not.toContain("hidden");
    expect(region.textContent).toContain("Example:");
    expect(region.textContent).toContain("Why it matters:");
    expect(region.textContent).toContain("What you can do:");
  });

  it("has no Learn more button for a simple term", () => {
    const h = mount(createElement(InfoTerm, { term: "Due date" }));
    act(() => button(h).click());
    expect(h.textContent).not.toContain("Learn more");
  });
});
