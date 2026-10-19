"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { getDb } from "@/db/client";
import { writeAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canManageSalesForce } from "@/core/permissions";
import type { SalesPersonForm } from "@/core/sales-force";
import {
  addSalesPerson,
  assignAccount,
  assignProduct,
  assignSupplierProducts,
  assignTenderOwner,
  setSalesPersonActive,
  updateSalesPerson,
} from "@/server/services/sales-force";

export type SalesFormState = { error?: string; saved?: boolean };
export type AssignState = { error?: string; saved?: boolean };

/** Only the signed-in company owner (the CEO) manages the sales force and assigns work to it. Guests and every other role are refused. */
async function ceo() {
  const user = await getCurrentUser();
  return user && !user.guest && canManageSalesForce(user.role) ? user : null;
}

const val = (fd: FormData, key: string) => String(fd.get(key) ?? "");
const orNull = (v: string) => (v === "" ? null : v);

const readForm = (fd: FormData): SalesPersonForm => ({
  name: val(fd, "name"),
  email: val(fd, "email"),
  suppliers: fd.getAll("suppliers").map(String),
  monthlySalesTarget: val(fd, "monthlySalesTarget"),
  newAccountsTarget: val(fd, "newAccountsTarget"),
  visitsPerWeek: val(fd, "visitsPerWeek"),
});

const REFUSED = "Only the company owner can change the sales force.";

export async function addSalesPersonAction(_prev: SalesFormState, fd: FormData): Promise<SalesFormState> {
  const user = await ceo();
  if (!user) return { error: REFUSED };
  const result = await addSalesPerson(getDb(), { companyId: user.companyId, form: readForm(fd) });
  if (!result.ok) return { error: result.error };
  await writeAudit({ companyId: user.companyId, userId: user.id, action: "sales_person.added", entityType: "sales_person", entityId: result.id });
  redirect(`/sales-force/${result.id}`);
}

export async function updateSalesPersonAction(_prev: SalesFormState, fd: FormData): Promise<SalesFormState> {
  const user = await ceo();
  if (!user) return { error: REFUSED };
  const id = val(fd, "id");
  const result = await updateSalesPerson(getDb(), { companyId: user.companyId, id, form: readForm(fd) });
  if (!result.ok) return { error: result.error };
  await writeAudit({ companyId: user.companyId, userId: user.id, action: "sales_person.updated", entityType: "sales_person", entityId: id });
  refresh();
  return { saved: true };
}

export async function setSalesPersonActiveAction(fd: FormData): Promise<void> {
  const user = await ceo();
  if (!user) return;
  const id = val(fd, "id");
  const active = val(fd, "active") === "true";
  const result = await setSalesPersonActive(getDb(), { companyId: user.companyId, id, active });
  if (result.ok) await writeAudit({ companyId: user.companyId, userId: user.id, action: active ? "sales_person.activated" : "sales_person.deactivated", entityType: "sales_person", entityId: id });
  refresh();
}

export async function assignTenderOwnerAction(_prev: AssignState, fd: FormData): Promise<AssignState> {
  const user = await ceo();
  if (!user) return { error: REFUSED };
  const tenderId = val(fd, "tenderId");
  const personId = orNull(val(fd, "ownerId"));
  const result = await assignTenderOwner(getDb(), { companyId: user.companyId, tenderId, ownerId: personId });
  if (!result.ok) return { error: result.error };
  await writeAudit({ companyId: user.companyId, userId: user.id, action: "tender.owner_assigned", entityType: "tender", entityId: tenderId, details: { ownerId: personId } });
  refresh();
  return { saved: true };
}

export async function assignProductAction(_prev: AssignState, fd: FormData): Promise<AssignState> {
  const user = await ceo();
  if (!user) return { error: REFUSED };
  const productId = val(fd, "productId");
  const personId = orNull(val(fd, "personId"));
  const result = await assignProduct(getDb(), { companyId: user.companyId, productId, personId });
  if (!result.ok) return { error: result.error };
  await writeAudit({ companyId: user.companyId, userId: user.id, action: "product.assigned", entityType: "product", entityId: productId, details: { personId } });
  refresh();
  return { saved: true };
}

export async function assignSupplierAction(_prev: AssignState, fd: FormData): Promise<AssignState & { count?: number }> {
  const user = await ceo();
  if (!user) return { error: REFUSED };
  const supplierName = val(fd, "supplierName");
  const personId = orNull(val(fd, "personId"));
  const result = await assignSupplierProducts(getDb(), { companyId: user.companyId, supplierName, personId });
  if (!result.ok) return { error: result.error };
  await writeAudit({ companyId: user.companyId, userId: user.id, action: "product.supplier_assigned", entityType: "supplier", details: { supplierName, personId, count: result.count } });
  refresh();
  return { saved: true, count: result.count };
}

/** Adds an account to a person (from their page) or removes it (personId empty). */
export async function assignAccountAction(fd: FormData): Promise<void> {
  const user = await ceo();
  if (!user) return;
  const customerId = val(fd, "customerId");
  const personId = orNull(val(fd, "personId"));
  const result = await assignAccount(getDb(), { companyId: user.companyId, customerId, personId });
  if (result.ok) await writeAudit({ companyId: user.companyId, userId: user.id, action: "account.assigned", entityType: "customer", entityId: customerId, details: { personId } });
  refresh();
}
