/**
 * What the owner adds about a machine the sales file cannot tell: when its warranty ends, whether it is under a service
 * contract, how much in consumables it should use each month. Pure. The machine itself is picked from a list of the machines
 * already known (taken from the imported sales), so a customer or product is never typed again; every field is optional,
 * and one left empty keeps what is already recorded.
 */
import { isIsoDate } from "./calc";
import type { ServiceStatus } from "./installed-base";
import { parseAmount } from "./support-indicators";

export const SERVICE_OPTIONS: readonly ServiceStatus[] = ["Active", "Expiring", "No contract"];

export interface MachineDetailsForm {
  code: string;
  installedOn: string;
  warrantyEnd: string;
  service: string;
  expectedMonthly: string;
  contractStart?: string;
  contractEnd?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export interface MachineDetails {
  code: string;
  installedOn: string | null;
  warrantyEnd: string | null;
  service: ServiceStatus | null;
  expectedMonthly: number | null;
  contractStart?: string | null;
  contractEnd?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
}

export type MachineDetailsResult = { ok: true; value: MachineDetails } | { ok: false; error: string };

/** `allowEmpty`: a machine being added needs no details; an existing one needs at least one, or there is nothing to save. */
export function cleanMachineDetails(form: MachineDetailsForm, today: string, opts: { allowEmpty?: boolean } = {}): MachineDetailsResult {
  const code = form.code.trim();
  if (code === "" || code.length > 80) return { ok: false, error: "Choose the machine from the list." };

  const date = (raw: string, label: string): string | null | { error: string } => {
    const v = raw.trim();
    if (v === "") return null;
    return isIsoDate(v) ? v : { error: `${label} is not a valid date.` };
  };
  const installedOn = date(form.installedOn, "The install date");
  if (installedOn !== null && typeof installedOn === "object") return { ok: false, error: installedOn.error };
  if (typeof installedOn === "string" && installedOn > today) return { ok: false, error: "The install date cannot be in the future." };
  const warrantyEnd = date(form.warrantyEnd, "The warranty end");
  if (warrantyEnd !== null && typeof warrantyEnd === "object") return { ok: false, error: warrantyEnd.error };
  if (typeof installedOn === "string" && typeof warrantyEnd === "string" && warrantyEnd < installedOn) return { ok: false, error: "The warranty cannot end before the machine was installed." };

  const service = form.service.trim();
  if (service !== "" && !(SERVICE_OPTIONS as readonly string[]).includes(service)) return { ok: false, error: "Choose Active, Expiring or No contract, or leave it empty." };

  const amount = form.expectedMonthly.trim();
  const expectedMonthly = amount === "" ? null : parseAmount(amount);
  if (amount !== "" && expectedMonthly === null) return { ok: false, error: "The expected consumables a month must be a number in JOD, or empty." };

  const contractStart = date(form.contractStart ?? "", "The contract start");
  if (contractStart !== null && typeof contractStart === "object") return { ok: false, error: contractStart.error };
  const contractEnd = date(form.contractEnd ?? "", "The contract end");
  if (contractEnd !== null && typeof contractEnd === "object") return { ok: false, error: contractEnd.error };
  if (typeof contractStart === "string" && typeof contractEnd === "string" && contractEnd < contractStart) return { ok: false, error: "The contract cannot end before it starts." };

  const contactName = (form.contactName ?? "").trim();
  const contactPhone = (form.contactPhone ?? "").trim();
  const contactEmail = (form.contactEmail ?? "").trim();
  if (contactName.length > 200) return { ok: false, error: "The contact name is too long." };
  if (contactPhone.length > 60) return { ok: false, error: "The contact phone is too long." };
  if (contactEmail !== "" && (contactEmail.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))) return { ok: false, error: "The contact email does not look like an email address." };

  const nothing = installedOn === null && warrantyEnd === null && service === "" && expectedMonthly === null && contractStart === null && contractEnd === null && contactName === "" && contactPhone === "" && contactEmail === "";
  if (nothing && !opts.allowEmpty) return { ok: false, error: "Fill in at least one detail: warranty end, service contract, contract dates, contact, install date or expected consumables." };
  return {
    ok: true,
    value: {
      code,
      installedOn: installedOn as string | null,
      warrantyEnd: warrantyEnd as string | null,
      service: (service || null) as ServiceStatus | null,
      expectedMonthly,
      contractStart: contractStart as string | null,
      contractEnd: contractEnd as string | null,
      contactName: contactName || null,
      contactPhone: contactPhone || null,
      contactEmail: contactEmail || null,
    },
  };
}

export interface NewMachineForm extends Omit<MachineDetailsForm, "code"> {
  code: string;
  name: string;
  customerCode: string;
}

export interface NewMachine {
  code: string;
  name: string;
  customerCode: string;
  details: MachineDetails;
}

export type NewMachineResult = { ok: true; value: NewMachine } | { ok: false; error: string };

/** A machine the sales file does not show (bought elsewhere, a loan unit): its own code, a name and a customer; every detail is optional. */
export function cleanNewMachine(form: NewMachineForm, today: string): NewMachineResult {
  const code = form.code.trim();
  if (code === "") return { ok: false, error: "Type a code for the machine, for example its serial number." };
  if (code.length > 80) return { ok: false, error: "The machine code is too long (80 characters at most)." };
  if (/^ERP-/i.test(code)) return { ok: false, error: "Codes starting with ERP- are used for machines taken from the sales. Choose another code." };
  const name = form.name.trim();
  if (name === "") return { ok: false, error: "Type the name of the machine." };
  if (name.length > 300) return { ok: false, error: "The machine name is too long (300 characters at most)." };
  const customerCode = form.customerCode.trim();
  if (customerCode === "") return { ok: false, error: "Choose the customer from the list." };
  const d = cleanMachineDetails({ ...form, code }, today, { allowEmpty: true });
  if (!d.ok) return d;
  return { ok: true, value: { code, name, customerCode, details: d.value } };
}
