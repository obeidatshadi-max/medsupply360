import { eq, sql } from "drizzle-orm";
import type { Db } from "@/db/import-writer";
import { companies, companyProfiles, products } from "@/db/schema";
import { cleanProfile, emptyProfile, type ProfileForm, type ProfileValues, type SupplierSummary } from "@/core/company-profile";

export type ProfileRecord = ProfileValues & { updatedBy: string | null; updatedAt: Date | null };

/** The company's name and what the owner wrote about it. A company that has written nothing yet gets empty fields. */
export async function getProfile(db: Db, companyId: string): Promise<ProfileRecord | null> {
  const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) return null;
  const [p] = await db.select().from(companyProfiles).where(eq(companyProfiles.companyId, companyId)).limit(1);
  if (!p) return { ...emptyProfile, companyName: company.name, updatedBy: null, updatedAt: null };
  return {
    companyName: company.name,
    location: p.location,
    address: p.address,
    founded: p.founded,
    team: p.team,
    audience: p.audience,
    purpose: p.purpose,
    erp: p.erp,
    notes: p.notes,
    updatedBy: p.updatedBy,
    updatedAt: p.updatedAt,
  };
}

export type SaveResult = { ok: true } | { ok: false; error: string };

/** Creates or replaces the company's profile text. `thisYear` bounds the founding year. */
export async function saveProfile(db: Db, input: { companyId: string; form: ProfileForm; by: string; thisYear: number }): Promise<SaveResult> {
  const c = cleanProfile(input.form, input.thisYear);
  if (!c.ok) return c;
  const { companyName, ...v } = c.value;
  // The name lives on the company, the rest on its profile; both change together or not at all.
  await db.transaction(async (tx) => {
    await tx.update(companies).set({ name: companyName }).where(eq(companies.id, input.companyId));
    await tx
      .insert(companyProfiles)
      .values({ companyId: input.companyId, ...v, updatedBy: input.by })
      .onConflictDoUpdate({ target: companyProfiles.companyId, set: { ...v, updatedBy: input.by, updatedAt: sql`now()` } });
  });
  return { ok: true };
}

/** The suppliers named on the product list, with how many products each carries. Products with no supplier name are not listed. */
export async function listSuppliers(db: Db, companyId: string): Promise<SupplierSummary[]> {
  const rows = await db
    .select({
      name: products.supplierName,
      products: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${products.active})::int`,
    })
    .from(products)
    .where(eq(products.companyId, companyId))
    .groupBy(products.supplierName);
  return rows
    .filter((r): r is typeof r & { name: string } => r.name !== null && r.name.trim() !== "")
    .map((r) => ({ name: r.name, products: r.products, activeProducts: r.active }))
    .sort((a, b) => b.products - a.products || a.name.localeCompare(b.name));
}
