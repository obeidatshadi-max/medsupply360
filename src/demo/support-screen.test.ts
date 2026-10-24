import { describe, expect, it } from "vitest";
import { indicatorStatus } from "@/core/support-indicators";
import { DEMO_INDICATORS, supportCsvRows, supportHtml } from "./support-screen";

describe("demo support functions", () => {
  it("shows every indicator once, off-target ones first, judged by the app's rules", () => {
    const html = supportHtml();
    for (const i of DEMO_INDICATORS) expect(html).toContain(i.name);
    const missed = DEMO_INDICATORS.filter((i) => indicatorStatus(i.direction, i.target, i.actual) === "missed");
    const firstOk = html.indexOf("Invoices issued within 2 days");
    for (const m of missed) expect(html.indexOf(m.name)).toBeLessThan(firstOk);
    expect(html).toContain("Off target");
    expect(html).toContain("No reading yet");
  });

  it("never lists a measurement after the demo's snapshot date", () => {
    expect(DEMO_INDICATORS.every((i) => i.measuredOn === null || i.measuredOn <= "2026-10-08")).toBe(true);
  });

  it("filters by search, escapes it, and exports what it shows", () => {
    expect(supportHtml({ query: "freight" })).toContain("On-time deliveries");
    expect(supportHtml({ query: "freight" })).not.toContain("Supplier deliveries on time");
    expect(supportHtml({ query: "<script>" })).not.toContain("<script>");
    expect(supportCsvRows()).toHaveLength(DEMO_INDICATORS.length + 1);
    expect(supportCsvRows("vacancy")).toHaveLength(2);
  });
});
