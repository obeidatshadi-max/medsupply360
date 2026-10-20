import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssignActionLink } from "./assign-action-link";

const html = (role: Parameters<typeof AssignActionLink>[0]["role"]) => renderToStaticMarkup(createElement(AssignActionLink, { role, title: "Review the gap", evidence: "A & B", responsible: "Sales manager" }));

describe("AssignActionLink", () => {
  it("shows to the owner and administrators with the form pre-filled and escaped", () => {
    for (const role of ["owner", "admin"] as const) {
      const out = html(role);
      expect(out).toContain("/opportunities?actionTitle=Review+the+gap");
      expect(out).toContain("actionEvidence=A+%26+B");
      expect(out).toContain("#add-action");
    }
  });
  it("shows nothing to anyone who cannot add actions", () => {
    for (const role of ["viewer", "tender", "finance"] as const) expect(html(role)).toBe("");
  });
});
