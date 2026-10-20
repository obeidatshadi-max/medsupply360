import { describe, expect, it } from "vitest";
import type { UnitInput } from "./installed-base";
import { buildServiceView, serviceGroup } from "./service-support";

const TODAY = "2026-10-20";
const unit = (over: Partial<UnitInput> = {}): UnitInput => ({
  code: "U1",
  name: "Analyzer",
  customerCode: "C1",
  customerName: "Hospital A",
  installedOn: "2024-01-01",
  warrantyEnd: "2028-01-01",
  service: "No contract",
  expectedMonthly: null,
  ...over,
});

describe("serviceGroup", () => {
  it("puts an active contract first, whatever the warranty says", () => {
    expect(serviceGroup({ service: "Active", warrantyEnd: "2020-01-01" }, TODAY)).toBe("covered");
    expect(serviceGroup({ service: "Expiring", warrantyEnd: "2020-01-01" }, TODAY)).toBe("contract_expiring");
  });

  it("splits 'no contract' by where the warranty stands", () => {
    expect(serviceGroup({ service: "No contract", warrantyEnd: "2026-06-01" }, TODAY)).toBe("out_of_warranty_uncovered");
    expect(serviceGroup({ service: "No contract", warrantyEnd: "2026-10-19" }, TODAY)).toBe("out_of_warranty_uncovered");
    expect(serviceGroup({ service: "No contract", warrantyEnd: "2026-10-20" }, TODAY)).toBe("warranty_ending_uncovered");
    expect(serviceGroup({ service: "No contract", warrantyEnd: "2027-01-18" }, TODAY)).toBe("warranty_ending_uncovered");
    expect(serviceGroup({ service: "No contract", warrantyEnd: "2027-01-19" }, TODAY)).toBe("in_warranty_uncovered");
    expect(serviceGroup({ service: "No contract", warrantyEnd: null }, TODAY)).toBe("uncovered_date_unknown");
  });

  it("keeps an unrecorded status apart from 'no contract': it is a data gap, not an opportunity", () => {
    expect(serviceGroup({ service: null, warrantyEnd: "2020-01-01" }, TODAY)).toBe("not_recorded");
  });
});

describe("buildServiceView", () => {
  const units = [
    unit({ code: "A", service: "Active" }),
    unit({ code: "B", service: "No contract", warrantyEnd: "2026-01-01", customerName: "Zed" }),
    unit({ code: "C", service: "No contract", warrantyEnd: "2026-03-01", customerName: "Alpha" }),
    unit({ code: "D", service: "Expiring" }),
    unit({ code: "E", service: null }),
    unit({ code: "F", service: "No contract", warrantyEnd: "2027-12-01" }),
  ];
  const v = buildServiceView(units, TODAY);

  it("orders the most urgent first, the longest-uncovered machine ahead of a newly uncovered one", () => {
    expect(v.rows.map((r) => r.unit.code)).toEqual(["B", "C", "D", "F", "E", "A"]);
  });

  it("counts every group and the headline figures", () => {
    expect(v.counts).toMatchObject({ out_of_warranty_uncovered: 2, contract_expiring: 1, in_warranty_uncovered: 1, not_recorded: 1, covered: 1 });
    expect(v.totals).toMatchObject({ units: 6, underContract: 1, toFollowUp: 4, notRecorded: 1 });
    expect(v.totals.coverage).toBeCloseTo(1 / 6);
  });

  it("gives no coverage figure when there are no units", () => {
    expect(buildServiceView([], TODAY).totals).toMatchObject({ units: 0, coverage: null, toFollowUp: 0 });
  });
});
