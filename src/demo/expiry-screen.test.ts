import { describe, expect, it } from "vitest";
import { demoExpiryItems, expiryAlertsHtml, isoFromDemoDate } from "./expiry-screen";

describe("demo expiry alerts", () => {
  it("reads the demo's written dates", () => {
    expect(isoFromDemoDate("30 Nov 2026")).toBe("2026-11-30");
    expect(isoFromDemoDate("1 Jan 2027")).toBe("2027-01-01");
    expect(isoFromDemoDate("soon")).toBeNull();
  });

  it("builds the list with the app's own rules from the demo machines", () => {
    const items = demoExpiryItems();
    expect(items.map((i) => [i.unitCode, i.kind, i.bucket])).toEqual([
      ["EQ-133", "contract", "30"],
      ["EQ-104", "warranty", "60"],
      ["DV-221", "contract", "90"],
      ["DV-208", "contract", "90"],
    ]);
    expect(items.every((i) => i.days >= 0 && i.days <= 90)).toBe(true);
  });

  it("shows the sections, the contact to call, and filters by kind", () => {
    const all = expiryAlertsHtml();
    expect(all).toContain("Ends within 30 days");
    expect(all).toContain("Lina Saleh");
    expect(all).toContain("Not recorded");
    const contracts = expiryAlertsHtml({ kind: "contract" });
    expect(contracts).toContain("Service contract");
    expect(contracts).not.toContain("<td data-label=\"What ends\">Warranty</td>");
  });
});
