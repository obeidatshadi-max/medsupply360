import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/import-writer";
import { customers, installedUnits, products } from "@/db/schema";
import type { UnitInput } from "@/core/installed-base";
import type { MachineDetails } from "@/core/machine-details";

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
    });
  }
  return { ok: true };
}
