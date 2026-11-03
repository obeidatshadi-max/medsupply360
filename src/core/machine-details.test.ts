import { describe, expect, it } from "vitest";
import { cleanMachineDetails, type MachineDetailsForm } from "./machine-details";

const TODAY = "2026-10-20";
const form = (over: Partial<MachineDetailsForm> = {}): MachineDetailsForm => ({ code: "ERP-C1-P3-1", installedOn: "", warrantyEnd: "2028-01-31", service: "Active", expectedMonthly: "450", ...over });

describe("cleanMachineDetails", () => {
  it("accepts the details of a chosen machine", () => {
    expect(cleanMachineDetails(form(), TODAY)).toEqual({ ok: true, value: { code: "ERP-C1-P3-1", installedOn: null, warrantyEnd: "2028-01-31", service: "Active", expectedMonthly: 450, contractStart: null, contractEnd: null, contactName: null, contactPhone: null, contactEmail: null } });
  });
  it("accepts one detail alone, the others staying empty", () => {
    expect(cleanMachineDetails(form({ warrantyEnd: "", service: "", expectedMonthly: "" , installedOn: "2024-05-01" }), TODAY)).toMatchObject({ ok: true, value: { installedOn: "2024-05-01", warrantyEnd: null, service: null, expectedMonthly: null } });
  });
  it("needs a machine and at least one detail", () => {
    expect(cleanMachineDetails(form({ code: "" }), TODAY).ok).toBe(false);
    expect(cleanMachineDetails(form({ warrantyEnd: "", service: "", expectedMonthly: "" }), TODAY).ok).toBe(false);
  });
  it("refuses a bad date, a future install date, a warranty before the install, an unknown service status and a bad amount", () => {
    for (const bad of [
      form({ warrantyEnd: "2028-02-30" }),
      form({ installedOn: "2026-12-01" }),
      form({ installedOn: "2025-01-01", warrantyEnd: "2024-01-01" }),
      form({ service: "Gold" }),
      form({ expectedMonthly: "lots" }),
      form({ expectedMonthly: "-5" }),
    ]) expect(cleanMachineDetails(bad, TODAY).ok).toBe(false);
  });
  it("reads Arabic digits in the amount", () => {
    expect(cleanMachineDetails(form({ expectedMonthly: "٤٥٠" }), TODAY)).toMatchObject({ ok: true, value: { expectedMonthly: 450 } });
  });

  it("accepts contract dates and a contact, and refuses a contract that ends before it starts or a bad email", () => {
    expect(cleanMachineDetails(form({ contractStart: "2026-01-01", contractEnd: "2027-01-01", contactName: " Rana ", contactPhone: "0790000000", contactEmail: "rana@example.com" }), TODAY)).toMatchObject({
      ok: true,
      value: { contractStart: "2026-01-01", contractEnd: "2027-01-01", contactName: "Rana", contactPhone: "0790000000", contactEmail: "rana@example.com" },
    });
    expect(cleanMachineDetails(form({ contractStart: "2027-01-01", contractEnd: "2026-01-01" }), TODAY).ok).toBe(false);
    expect(cleanMachineDetails(form({ contactEmail: "not an email" }), TODAY).ok).toBe(false);
  });
  it("counts a contact alone as a detail", () => {
    expect(cleanMachineDetails(form({ warrantyEnd: "", service: "", expectedMonthly: "", contactName: "Rana" }), TODAY).ok).toBe(true);
  });
});
