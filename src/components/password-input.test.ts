import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PasswordInput } from "./password-input";

describe("PasswordInput", () => {
  const html = renderToStaticMarkup(createElement(PasswordInput, { id: "password", name: "password", autoComplete: "current-password", required: true, className: "field" }));

  it("starts hidden, with a Show button for the field", () => {
    expect(html).toContain('type="password"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-controls="password"');
    expect(html).toContain("Show");
  });

  it("keeps the browser's autofill hints and the form field name", () => {
    expect(html).toMatch(/autocomplete="current-password"/i);
    expect(html).toContain('name="password"');
  });

  it("never submits the form from the toggle button", () => {
    expect(html).toContain('<button type="button"');
  });
});
