import { describe, expect, it } from "vitest";
import { checkAgainstErp, erpDifferences, prefillFromErp } from "./tender-erp";

const erp = (over: Partial<Parameters<typeof checkAgainstErp>[1] & object> = {}) => ({ found: true, snapshotDate: "2031-03-31", remaining: 500, invoiceDate: null, dueDate: null, customerName: null, netSales: null, ...over });

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

describe("erpDifferences", () => {
  const inv = { invoiceDate: "2027-02-01", dueDate: "2027-04-02" };
  it("says nothing when the ERP agrees, does not know the number, or does not hold a date", () => {
    expect(erpDifferences(inv, erp({ invoiceDate: "2027-02-01", dueDate: "2027-04-02" }))).toEqual([]);
    expect(erpDifferences(inv, undefined)).toEqual([]);
    expect(erpDifferences(inv, erp({ found: false, invoiceDate: "2020-01-01" }))).toEqual([]);
    expect(erpDifferences(inv, erp())).toEqual([]); // the ERP holds no dates
    expect(erpDifferences({ invoiceDate: "2027-02-01", dueDate: null }, erp({ dueDate: "2027-05-01" }))).toEqual([]); // no tender due date to compare
  });

  it("names each date that differs", () => {
    expect(erpDifferences(inv, erp({ invoiceDate: "2027-02-03" }))).toEqual(["the ERP dates this invoice 2027-02-03"]);
    expect(erpDifferences(inv, erp({ dueDate: "2027-05-01" }))).toEqual(["the ERP due date is 2027-05-01"]);
    expect(erpDifferences(inv, erp({ invoiceDate: "2027-02-03", dueDate: "2027-05-01" }))).toHaveLength(2);
  });

  it("does not compare amounts: the ERP holds net sales before tax", () => {
    expect(erpDifferences(inv, erp({ netSales: 100 }))).toEqual([]);
  });
});

describe("prefillFromErp", () => {
  it("hands back only the safe fields, and nothing for an unknown number", () => {
    expect(prefillFromErp(undefined)).toBeNull();
    expect(prefillFromErp(erp({ found: false }))).toBeNull();
    expect(prefillFromErp(erp({ invoiceDate: "2027-02-01", dueDate: null, customerName: "Hospital", netSales: 862.07 }))).toEqual({ invoiceDate: "2027-02-01", dueDate: null, customerName: "Hospital", netSales: 862.07 });
  });
});
