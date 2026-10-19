import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CompanyAccounts } from "./company-accounts";

const account = (owner: string | null, importedOwner: string | null) => ({
  code: "C1", name: "Clinic", segment: "private", owner, ownerId: owner ? "11111111-1111-4111-8111-111111111111" : null, importedOwner, city: null, active: true,
  sales: 100, costedSales: 100, grossProfit: 40, linesWithoutCost: 0, outstanding: 0, overdue: 0, unagedInvoices: 0, lastOrder: null,
});
const html = (a: ReturnType<typeof account>, ownerLinks = false) =>
  renderToStaticMarkup(createElement(CompanyAccounts, {
    view: "all", ownerLinks,
    report: { from: "2026-01-01", to: "2026-10-01", snapshotDate: null, hasSales: true, search: "", totalAccounts: 1, matchedCount: 1, rows: [a], summary: { sales: 100, grossProfit: 40, costCoverage: 1, outstanding: 0, overdue: 0 } },
  }));

describe("account owner", () => {
  it("shows the assigned person and flags a different name in the customer file", () => {
    expect(html(account("Sara", "Omar"))).toContain("Sara (customer file: Omar)");
  });
  it("shows one name when the assignment and the customer file agree, ignoring case", () => {
    const h = html(account("Sara", "sara"));
    expect(h).toContain("Sara"); expect(h).not.toContain("customer file");
  });
  it("shows the customer-file name when nobody is assigned", () => {
    const h = html(account("Omar", "Omar"));
    expect(h).toContain("Omar"); expect(h).not.toContain("customer file");
  });
});

describe("owner link", () => {
  it("links the assigned person to their Sales force page only when the viewer may open it", () => {
    expect(html(account("Sara", "Sara"), true)).toContain('href="/sales-force/11111111-1111-4111-8111-111111111111"');
    expect(html(account("Sara", "Sara"), false)).not.toContain("/sales-force/");
    expect(html(account(null, null), true)).not.toContain("/sales-force/");
  });
});
