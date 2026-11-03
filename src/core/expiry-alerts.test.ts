import { describe, expect, it } from "vitest";
import { bucketOf, buildExpiryList, daysText, summarizeExpiry } from "./expiry-alerts";
import type { UnitInput } from "./installed-base";

const TODAY = "2026-10-20";
const unit = (over: Partial<UnitInput> = {}): UnitInput => ({
  code: "U1",
  name: "Analyzer",
  customerCode: "C1",
  customerName: "Hospital A",
  installedOn: "2024-01-01",
  warrantyEnd: null,
  service: null,
  expectedMonthly: null,
  ...over,
});

describe("bucketOf", () => {
  it("places days in the right window, and outside it nothing", () => {
    expect(bucketOf(-31)).toBeNull();
    expect(bucketOf(-30)).toBe("ended");
    expect(bucketOf(-1)).toBe("ended");
    expect(bucketOf(0)).toBe("30");
    expect(bucketOf(30)).toBe("30");
    expect(bucketOf(31)).toBe("60");
    expect(bucketOf(60)).toBe("60");
    expect(bucketOf(61)).toBe("90");
    expect(bucketOf(90)).toBe("90");
    expect(bucketOf(91)).toBeNull();
  });
});

describe("buildExpiryList", () => {
  it("lists contracts and warranties by date, soonest first, with the days left", () => {
    const list = buildExpiryList(
      [
        unit({ code: "U1", warrantyEnd: "2026-12-01", contractEnd: "2026-11-05" }),
        unit({ code: "U2", name: "Pump", contractEnd: "2026-10-25" }),
        unit({ code: "U3", name: "Old", warrantyEnd: "2025-01-01" }),
      ],
      TODAY,
    );
    expect(list.map((i) => [i.unitCode, i.kind, i.days, i.bucket])).toEqual([
      ["U2", "contract", 5, "30"],
      ["U1", "contract", 16, "30"],
      ["U1", "warranty", 42, "60"],
    ]);
  });

  it("keeps a date that has just passed, and drops ones that passed long ago or are far away", () => {
    const list = buildExpiryList([unit({ contractEnd: "2026-10-10" }), unit({ code: "U2", contractEnd: "2026-08-01" }), unit({ code: "U3", contractEnd: "2027-06-01" })], TODAY);
    expect(list.map((i) => [i.unitCode, i.bucket])).toEqual([["U1", "ended"]]);
  });

  it("carries the contact to call, and none when there is no contact", () => {
    const [a, b] = buildExpiryList([unit({ contractEnd: "2026-10-30", contactName: "Rana", contactPhone: "0790000000" }), unit({ code: "U2", contractEnd: "2026-10-31" })], TODAY);
    expect(a!.contact).toBe("Rana · 0790000000");
    expect(b!.contact).toBeNull();
  });

  it("ignores machines with no dates", () => {
    expect(buildExpiryList([unit()], TODAY)).toEqual([]);
  });
});

describe("summarizeExpiry", () => {
  it("counts by window and kind, and says how many machines have no date at all", () => {
    const units = [unit({ contractEnd: "2026-10-25" }), unit({ code: "U2", warrantyEnd: "2026-12-30" }), unit({ code: "U3" })];
    const s = summarizeExpiry(buildExpiryList(units, TODAY), units);
    expect(s).toEqual({ total: 2, byBucket: { ended: 0, "30": 1, "60": 0, "90": 1 }, byKind: { contract: 1, warranty: 1 }, machinesWithoutDates: 1 });
  });
});

describe("daysText", () => {
  it("words the days", () => {
    expect(daysText(0)).toBe("today");
    expect(daysText(1)).toBe("tomorrow");
    expect(daysText(12)).toBe("in 12 days");
    expect(daysText(-1)).toBe("yesterday");
    expect(daysText(-3)).toBe("3 days ago");
  });
});
