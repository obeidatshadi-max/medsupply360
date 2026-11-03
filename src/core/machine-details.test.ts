import { describe, expect, it } from "vitest";
import { cleanMachineDetails, cleanNewMachine, type MachineDetailsForm } from "./machine-details";

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

describe("cleanNewMachine", () => {
  const base = { code: " SN-2041 ", name: " Portable X-ray ", customerCode: "C-0001", installedOn: "", warrantyEnd: "", service: "", expectedMonthly: "" };

  it("accepts a machine with only a code, a name and a customer", () => {
    expect(cleanNewMachine(base, TODAY)).toMatchObject({ ok: true, value: { code: "SN-2041", name: "Portable X-ray", customerCode: "C-0001", details: { warrantyEnd: null, service: null } } });
  });

  it("keeps the optional details and contract dates when given", () => {
    const r = cleanNewMachine({ ...base, warrantyEnd: "2028-01-31", service: "Active", contractStart: "2026-01-01", contractEnd: "2027-01-01", contactName: "Rana" }, TODAY);
    expect(r).toMatchObject({ ok: true, value: { details: { warrantyEnd: "2028-01-31", service: "Active", contractEnd: "2027-01-01", contactName: "Rana" } } });
  });

  it("needs a code, a name and a customer", () => {
    expect(cleanNewMachine({ ...base, code: " " }, TODAY).ok).toBe(false);
    expect(cleanNewMachine({ ...base, name: "" }, TODAY).ok).toBe(false);
    expect(cleanNewMachine({ ...base, customerCode: "" }, TODAY).ok).toBe(false);
  });

  it("refuses the ERP- prefix that belongs to machines taken from the sales, and too-long text", () => {
    expect(cleanNewMachine({ ...base, code: "ERP-C1-P1-1" }, TODAY).ok).toBe(false);
    expect(cleanNewMachine({ ...base, code: "x".repeat(81) }, TODAY).ok).toBe(false);
    expect(cleanNewMachine({ ...base, name: "x".repeat(301) }, TODAY).ok).toBe(false);
  });

  it("still checks the details it is given", () => {
    expect(cleanNewMachine({ ...base, contractStart: "2027-01-01", contractEnd: "2026-01-01" }, TODAY).ok).toBe(false);
    expect(cleanNewMachine({ ...base, installedOn: "2999-01-01" }, TODAY).ok).toBe(false);
  });
});
