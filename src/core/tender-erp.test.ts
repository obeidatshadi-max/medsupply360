import { describe, expect, it } from "vitest";
import { checkAgainstErp } from "./tender-erp";

const erp = (over: Partial<Parameters<typeof checkAgainstErp>[1] & object> = {}) => ({ found: true, snapshotDate: "2031-03-31", remaining: 500, ...over });

describe("checkAgainstErp", () => {
  it("says nothing is known when the number is not in the ERP files", () => {
    expect(checkAgainstErp(500, undefined)).toEqual({ kind: "not-found" });
    expect(checkAgainstErp(500, erp({ found: false }))).toEqual({ kind: "not-found" });
  });

  it("does not judge when no unpaid-invoice file was imported", () => {
    expect(checkAgainstErp(500, erp({ snapshotDate: null, remaining: null }))).toEqual({ kind: "no-snapshot" });
  });

  it("agrees when both show the same amount unpaid, to the fils", () => {
    expect(checkAgainstErp(500, erp())).toEqual({ kind: "agrees", remaining: 500, snapshotDate: "2031-03-31" });
    expect(checkAgainstErp(500.0004, erp())).toMatchObject({ kind: "agrees" });
  });

  it("differs when the amounts differ", () => {
    expect(checkAgainstErp(0, erp())).toEqual({ kind: "differs", remaining: 500, snapshotDate: "2031-03-31" });
    expect(checkAgainstErp(500, erp({ remaining: 499.999 }))).toMatchObject({ kind: "differs" });
  });

  it("treats an invoice missing from the newest unpaid file as paid", () => {
    expect(checkAgainstErp(0, erp({ remaining: null }))).toEqual({ kind: "agrees", remaining: 0, snapshotDate: "2031-03-31" });
    expect(checkAgainstErp(120, erp({ remaining: null }))).toEqual({ kind: "differs", remaining: 0, snapshotDate: "2031-03-31" });
  });
});
