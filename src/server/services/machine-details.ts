import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/import-writer";
import { customers, installedUnits, products } from "@/db/schema";
import type { UnitInput } from "@/core/installed-base";
import type { MachineDetails, NewMachine } from "@/core/machine-details";

export type SaveDetailsResult = { ok: true } | { ok: false; error: string };

/**
 * Records what the owner knows about a machine. The machine is one the app already knows (from the imported sales or an
 * earlier entry), so its customer and product are looked up, never typed. A detail left empty keeps what is recorded;
 * a machine described for the first time gets a row under the same code, which replaces its sales-derived twin.
 */
export async function saveMachineDetails(db: Db, input: { companyId: string; unit: UnitInput; details: MachineDetails }): Promise<SaveDetailsResult> {
  const { companyId, unit, details } = input;
  const [customer] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.companyId, companyId), eq(customers.code, unit.customerCode))).limit(1);
  if (!customer) return { ok: false, error: "That machine's customer is not in the customer list." };
  let productId: string | null = null;
  if (unit.productCode) {
    const [p] = await db.select({ id: products.id }).from(products).where(and(eq(products.companyId, companyId), eq(products.code, unit.productCode))).limit(1);
    productId = p?.id ?? null;
  }
  const [existing] = await db.select({ id: installedUnits.id }).from(installedUnits).where(and(eq(installedUnits.companyId, companyId), eq(installedUnits.code, unit.code))).limit(1);

  const given = {
    installedOn: details.installedOn,
    warrantyEnd: details.warrantyEnd,
    service: details.service,
    expectedMonthlyConsumables: details.expectedMonthly === null ? null : String(details.expectedMonthly),
    contractStart: details.contractStart ?? null,
    contractEnd: details.contractEnd ?? null,
    contactName: details.contactName ?? null,
    contactPhone: details.contactPhone ?? null,
    contactEmail: details.contactEmail ?? null,
  };
  if (existing) {
    const set = Object.fromEntries(Object.entries(given).filter(([, v]) => v !== null));
    await db.update(installedUnits).set(set).where(and(eq(installedUnits.companyId, companyId), eq(installedUnits.id, existing.id)));
  } else {
    await db.insert(installedUnits).values({
      companyId,
      code: unit.code,
      customerId: customer.id,
      productId,
      name: unit.name,
      installedOn: given.installedOn ?? unit.installedOn,
      warrantyEnd: given.warrantyEnd,
      service: given.service,
      expectedMonthlyConsumables: given.expectedMonthlyConsumables,
      contractStart: given.contractStart,
      contractEnd: given.contractEnd,
      contactName: given.contactName,
      contactPhone: given.contactPhone,
      contactEmail: given.contactEmail,
    });
  }
  return { ok: true };
}

/** Customers the owner or maintenance may pick for a new machine: code and name, by name. */
export async function listCustomerOptions(db: Db, companyId: string): Promise<{ code: string; name: string }[]> {
  return db.select({ code: customers.code, name: customers.name }).from(customers).where(eq(customers.companyId, companyId)).orderBy(customers.name).limit(5000);
}

/**
 * Adds a machine that the sales do not show. The customer must be on the customer list (it is looked up by code, never typed
 * again) and the code must be new: an existing machine is changed with its details form instead, so nothing is overwritten by mistake.
 */
export async function addMachine(db: Db, input: { companyId: string; machine: NewMachine }): Promise<SaveDetailsResult> {
  const { companyId, machine } = input;
  const [customer] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.companyId, companyId), eq(customers.code, machine.customerCode))).limit(1);
  if (!customer) return { ok: false, error: "That customer is not on the customer list. Load the customer list first, or choose another customer." };
  const [existing] = await db.select({ id: installedUnits.id }).from(installedUnits).where(and(eq(installedUnits.companyId, companyId), eq(installedUnits.code, machine.code))).limit(1);
  if (existing) return { ok: false, error: "A machine with this code already exists. Choose it in Machine details above to change it." };
  const d = machine.details;
  await db.insert(installedUnits).values({
    companyId,
    code: machine.code,
    customerId: customer.id,
    productId: null,
    name: machine.name,
    installedOn: d.installedOn,
    warrantyEnd: d.warrantyEnd,
    service: d.service,
    expectedMonthlyConsumables: d.expectedMonthly === null ? null : String(d.expectedMonthly),
    contractStart: d.contractStart ?? null,
    contractEnd: d.contractEnd ?? null,
    contactName: d.contactName ?? null,
    contactPhone: d.contactPhone ?? null,
    contactEmail: d.contactEmail ?? null,
  });
  return { ok: true };
}
