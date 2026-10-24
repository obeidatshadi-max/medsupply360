import { describe, expect, it } from "vitest";
import { deliveryProgress } from "./tender-deliveries";

describe("deliveryProgress", () => {
  it("adds the values, reports the share of the contract and what is still to deliver", () => {
    const p = deliveryProgress(141300, [
      { deliveredOn: "2026-10-05", value: 41300 },
      { deliveredOn: "2026-09-28", value: 60000 },
    ]);
    expect(p).toEqual({ count: 2, deliveredValue: 101300, withoutValue: 0, outstanding: 40000, percent: 71.7, overDelivered: 0, lastDeliveredOn: "2026-10-05" });
  });

  it("is complete at exactly the contract value and flags anything above it instead of refusing it", () => {
    expect(deliveryProgress(1000, [{ deliveredOn: "2026-01-01", value: 1000 }])).toMatchObject({ outstanding: 0, percent: 100, overDelivered: 0 });
    expect(deliveryProgress(1000, [{ deliveredOn: "2026-01-01", value: 1100.5 }])).toMatchObject({ outstanding: 0, percent: 110.1, overDelivered: 100.5 });
  });

  it("counts a delivery without a value but does not invent its value, and says the total is a minimum", () => {
    const p = deliveryProgress(500, [
      { deliveredOn: "2026-02-01", value: 200 },
      { deliveredOn: "2026-02-10", value: null },
    ]);
    expect(p).toMatchObject({ count: 2, deliveredValue: 200, withoutValue: 1, outstanding: 300, percent: 40 });
  });

  it("works with no deliveries and with an unknown or zero contract value", () => {
    expect(deliveryProgress(500, [])).toEqual({ count: 0, deliveredValue: 0, withoutValue: 0, outstanding: 500, percent: 0, overDelivered: 0, lastDeliveredOn: null });
    expect(deliveryProgress(null, [{ deliveredOn: "2026-02-01", value: 200 }])).toMatchObject({ outstanding: null, percent: null, overDelivered: 0, deliveredValue: 200 });
    expect(deliveryProgress(0, [{ deliveredOn: "2026-02-01", value: 200 }])).toMatchObject({ outstanding: null, percent: null });
  });

  it("rounds sums to the fils", () => {
    expect(deliveryProgress(1, [{ deliveredOn: "2026-01-01", value: 0.1 }, { deliveredOn: "2026-01-02", value: 0.2 }]).deliveredValue).toBe(0.3);
  });
});
