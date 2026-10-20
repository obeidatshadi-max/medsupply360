import { and, asc, desc, eq, gte, ilike, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import type { Db } from "@/db/import-writer";
import { customers, invoices, products, salesLines, salesPeople, salesVisits, tenders } from "@/db/schema";
import { cleanSalesPerson, isUuid, type SalesPersonForm } from "@/core/sales-force";
import { cleanVisit, type VisitForm } from "@/core/sales-activity";

export type SalesPersonRow = {
  id: string;
  name: string;
  email: string | null;
  supplierNames: string[];
  monthlySalesTarget: number | null;
  newAccountsTarget: number | null;
  visitsPerWeek: number | null;
  active: boolean;
  products: number;
  accounts: number;
  tenders: number;
};

export type SalesResult = { ok: true; id: string } | { ok: false; error: string };

const num = (v: string | null): number | null => (v === null ? null : Number(v));
const NOT_FOUND = "That person was not found.";
const ACCOUNT_NOT_FOUND = "That customer was not found.";

type Raw = typeof salesPeople.$inferSelect;
const toRow = (r: Raw, counts: { products: number; accounts: number; tenders: number }): SalesPersonRow => ({
  id: r.id,
  name: r.name,
  email: r.email,
  supplierNames: r.supplierNames,
  monthlySalesTarget: num(r.monthlySalesTarget),
  newAccountsTarget: r.newAccountsTarget,
  visitsPerWeek: r.visitsPerWeek,
  active: r.active,
  ...counts,
});

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

/** How many products, accounts and tenders each person holds, for one company. */
async function countsFor(db: Db, companyId: string): Promise<Map<string, { products: number; accounts: number; tenders: number }>> {
  const out = new Map<string, { products: number; accounts: number; tenders: number }>();
  const slot = (id: string) => out.get(id) ?? out.set(id, { products: 0, accounts: 0, tenders: 0 }).get(id)!;
  const n = sql<number>`count(*)::int`;
  for (const r of await db.select({ id: products.salesPersonId, n }).from(products).where(and(eq(products.companyId, companyId), isNotNull(products.salesPersonId))).groupBy(products.salesPersonId)) slot(r.id!).products = r.n;
  for (const r of await db.select({ id: customers.salesPersonId, n }).from(customers).where(and(eq(customers.companyId, companyId), isNotNull(customers.salesPersonId))).groupBy(customers.salesPersonId)) slot(r.id!).accounts = r.n;
  for (const r of await db.select({ id: tenders.ownerId, n }).from(tenders).where(and(eq(tenders.companyId, companyId), isNotNull(tenders.ownerId))).groupBy(tenders.ownerId)) slot(r.id!).tenders = r.n;
  return out;
}

/** One company's sales force. Active people first, then by name. */
export async function listSalesPeople(db: Db, companyId: string): Promise<SalesPersonRow[]> {
  const [rows, counts] = await Promise.all([
    db.select().from(salesPeople).where(eq(salesPeople.companyId, companyId)).orderBy(sql`${salesPeople.active} desc`, asc(sql`lower(${salesPeople.name})`)),
    countsFor(db, companyId),
  ]);
  return rows.map((r) => toRow(r, counts.get(r.id) ?? { products: 0, accounts: 0, tenders: 0 }));
}

export async function getSalesPerson(db: Db, companyId: string, id: string): Promise<SalesPersonRow | null> {
  if (!isUuid(id)) return null;
  return (await listSalesPeople(db, companyId)).find((p) => p.id === id.toLowerCase()) ?? null;
}

const values = (form: SalesPersonForm) => {
  const c = cleanSalesPerson(form);
  if (!c.ok) return c;
  const v = c.value;
  return {
    ok: true as const,
    set: {
      name: v.name,
      email: v.email,
      supplierNames: v.supplierNames,
      monthlySalesTarget: v.monthlySalesTarget === null ? null : String(v.monthlySalesTarget),
      newAccountsTarget: v.newAccountsTarget,
      visitsPerWeek: v.visitsPerWeek,
    },
  };
};

const DUPLICATE = "This name is already in the sales force.";

export async function addSalesPerson(db: Db, input: { companyId: string; form: SalesPersonForm }): Promise<SalesResult> {
  const v = values(input.form);
  if (!v.ok) return v;
  try {
    const [row] = await db.insert(salesPeople).values({ companyId: input.companyId, ...v.set }).returning({ id: salesPeople.id });
    return { ok: true, id: row!.id };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    return { ok: false, error: DUPLICATE };
  }
}

export async function updateSalesPerson(db: Db, input: { companyId: string; id: string; form: SalesPersonForm }): Promise<SalesResult> {
  if (!isUuid(input.id)) return { ok: false, error: NOT_FOUND };
  const v = values(input.form);
  if (!v.ok) return v;
  try {
    const changed = await db.update(salesPeople).set(v.set).where(and(eq(salesPeople.companyId, input.companyId), eq(salesPeople.id, input.id))).returning({ id: salesPeople.id });
    return changed.length ? { ok: true, id: input.id } : { ok: false, error: NOT_FOUND };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    return { ok: false, error: DUPLICATE };
  }
}

export async function setSalesPersonActive(db: Db, input: { companyId: string; id: string; active: boolean }): Promise<SalesResult> {
  if (!isUuid(input.id)) return { ok: false, error: NOT_FOUND };
  const changed = await db.update(salesPeople).set({ active: input.active }).where(and(eq(salesPeople.companyId, input.companyId), eq(salesPeople.id, input.id))).returning({ id: salesPeople.id });
  return changed.length ? { ok: true, id: input.id } : { ok: false, error: NOT_FOUND };
}

/**
 * Checks that `personId` may be given something new: the person exists in this company and is turned on. A person who
 * already holds the item (`currentId`) may always be kept, even if they were turned off since.
 */
async function canChoose(db: Db, companyId: string, personId: string | null, currentId: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  if (personId === null || personId === currentId) return { ok: true };
  if (!isUuid(personId)) return { ok: false, error: "Choose a person from the list." };
  const [p] = await db.select({ active: salesPeople.active }).from(salesPeople).where(and(eq(salesPeople.companyId, companyId), eq(salesPeople.id, personId))).limit(1);
  if (!p) return { ok: false, error: "Choose a person from the list." };
  if (!p.active) return { ok: false, error: "That person is turned off. Turn them on first." };
  return { ok: true };
}

/** Sets or clears a tender's owner. Keeping the person already on the tender is always allowed. */
export async function assignTenderOwner(db: Db, input: { companyId: string; tenderId: string; ownerId: string | null }): Promise<SalesResult> {
  if (!isUuid(input.tenderId)) return { ok: false, error: "That tender was not found." };
  const [t] = await db.select({ ownerId: tenders.ownerId }).from(tenders).where(and(eq(tenders.companyId, input.companyId), eq(tenders.id, input.tenderId))).limit(1);
  if (!t) return { ok: false, error: "That tender was not found." };
  const ok = await canChoose(db, input.companyId, input.ownerId, t.ownerId);
  if (!ok.ok) return ok;
  await db.update(tenders).set({ ownerId: input.ownerId, updatedAt: sql`now()` }).where(and(eq(tenders.companyId, input.companyId), eq(tenders.id, input.tenderId)));
  return { ok: true, id: input.tenderId };
}

/** Sets or clears the sales person of one product. */
export async function assignProduct(db: Db, input: { companyId: string; productId: string; personId: string | null }): Promise<SalesResult> {
  if (!isUuid(input.productId)) return { ok: false, error: "That product was not found." };
  const [p] = await db.select({ salesPersonId: products.salesPersonId }).from(products).where(and(eq(products.companyId, input.companyId), eq(products.id, input.productId))).limit(1);
  if (!p) return { ok: false, error: "That product was not found." };
  const ok = await canChoose(db, input.companyId, input.personId, p.salesPersonId);
  if (!ok.ok) return ok;
  await db.update(products).set({ salesPersonId: input.personId }).where(and(eq(products.companyId, input.companyId), eq(products.id, input.productId)));
  return { ok: true, id: input.productId };
}

/** Gives every product of one supplier to one person (or to nobody). Returns how many products changed. */
export async function assignSupplierProducts(db: Db, input: { companyId: string; supplierName: string; personId: string | null }): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const supplier = input.supplierName.trim();
  if (supplier === "") return { ok: false, error: "Choose a supplier." };
  const ok = await canChoose(db, input.companyId, input.personId, null);
  if (!ok.ok) return ok;
  const changed = await db
    .update(products)
    .set({ salesPersonId: input.personId })
    .where(and(eq(products.companyId, input.companyId), eq(products.supplierName, supplier)))
    .returning({ id: products.id });
  return { ok: true, count: changed.length };
}

/** Sets or clears the sales person of one customer account. */
export async function assignAccount(db: Db, input: { companyId: string; customerId: string; personId: string | null }): Promise<SalesResult> {
  if (!isUuid(input.customerId)) return { ok: false, error: ACCOUNT_NOT_FOUND };
  const [c] = await db.select({ salesPersonId: customers.salesPersonId }).from(customers).where(and(eq(customers.companyId, input.companyId), eq(customers.id, input.customerId))).limit(1);
  if (!c) return { ok: false, error: ACCOUNT_NOT_FOUND };
  const ok = await canChoose(db, input.companyId, input.personId, c.salesPersonId);
  if (!ok.ok) return ok;
  await db.update(customers).set({ salesPersonId: input.personId }).where(and(eq(customers.companyId, input.companyId), eq(customers.id, input.customerId)));
  return { ok: true, id: input.customerId };
}

export type ProductAssignRow = { id: string; code: string; name: string; line: string; therapeuticArea: string | null; supplierName: string | null; salesPersonId: string | null; salesPersonName: string | null };

/** Active products with who holds each, grouped by supplier then name, for the quick-assign list on Products & suppliers. */
export async function listProductsForAssignment(db: Db, companyId: string, limit = 3000): Promise<ProductAssignRow[]> {
  return db
    .select({
      id: products.id,
      code: products.code,
      name: products.name,
      line: sql<string>`${products.line}::text`,
      therapeuticArea: products.therapeuticArea,
      supplierName: products.supplierName,
      salesPersonId: products.salesPersonId,
      salesPersonName: salesPeople.name,
    })
    .from(products)
    .leftJoin(salesPeople, and(eq(salesPeople.companyId, products.companyId), eq(salesPeople.id, products.salesPersonId)))
    .where(and(eq(products.companyId, companyId), eq(products.active, true)))
    .orderBy(asc(sql`lower(coalesce(${products.supplierName}, ''))`), asc(sql`lower(${products.name})`))
    .limit(limit);
}

export async function listPersonProducts(db: Db, companyId: string, personId: string) {
  return db
    .select({ id: products.id, code: products.code, name: products.name, supplierName: products.supplierName })
    .from(products)
    .where(and(eq(products.companyId, companyId), eq(products.salesPersonId, personId)))
    .orderBy(asc(sql`lower(coalesce(${products.supplierName}, ''))`), asc(sql`lower(${products.name})`));
}

export async function listPersonAccounts(db: Db, companyId: string, personId: string) {
  return db
    .select({ id: customers.id, code: customers.code, name: customers.name, city: customers.city })
    .from(customers)
    .where(and(eq(customers.companyId, companyId), eq(customers.salesPersonId, personId)))
    .orderBy(asc(sql`lower(${customers.name})`));
}

export async function listPersonTenders(db: Db, companyId: string, personId: string) {
  return db
    .select({ id: tenders.id, title: tenders.title, authority: tenders.authority, status: tenders.status })
    .from(tenders)
    .where(and(eq(tenders.companyId, companyId), eq(tenders.ownerId, personId)))
    .orderBy(asc(sql`lower(${tenders.title})`));
}

/** Customers with nobody assigned yet, optionally filtered by name or code, for the "add an account" picker. */
export async function listUnassignedAccounts(db: Db, companyId: string, search: string, limit = 100) {
  const q = search.trim().replace(/[%_\\]/g, (c) => `\\${c}`);
  return db
    .select({ id: customers.id, code: customers.code, name: customers.name, city: customers.city })
    .from(customers)
    .where(and(eq(customers.companyId, companyId), eq(customers.active, true), isNull(customers.salesPersonId), q === "" ? undefined : or(ilike(customers.name, `%${q}%`), ilike(customers.code, `%${q}%`))))
    .orderBy(asc(sql`lower(${customers.name})`))
    .limit(limit);
}

/** Net sales (after returns, without tax) on each person's accounts between two dates. Accounts nobody holds are left out. */
export async function salesByPerson(db: Db, companyId: string, from: string, to: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ id: customers.salesPersonId, sales: sql<string>`coalesce(sum(${salesLines.netSales}), 0)::text` })
    .from(salesLines)
    .innerJoin(invoices, and(eq(invoices.companyId, salesLines.companyId), eq(invoices.id, salesLines.invoiceId)))
    .innerJoin(customers, and(eq(customers.companyId, invoices.companyId), eq(customers.id, invoices.customerId)))
    .where(and(eq(salesLines.companyId, companyId), isNotNull(customers.salesPersonId), gte(invoices.invoiceDate, from), lte(invoices.invoiceDate, to)))
    .groupBy(customers.salesPersonId);
  return new Map(rows.map((r) => [r.id!, Number(r.sales)]));
}

/**
 * Net sales (after returns, without tax) of the products each person holds between two dates, whoever bought them. This
 * is a second view beside `salesByPerson`: one sale can count in both, so the two are never added together.
 */
export async function salesByPersonProducts(db: Db, companyId: string, from: string, to: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ id: products.salesPersonId, sales: sql<string>`coalesce(sum(${salesLines.netSales}), 0)::text` })
    .from(salesLines)
    .innerJoin(invoices, and(eq(invoices.companyId, salesLines.companyId), eq(invoices.id, salesLines.invoiceId)))
    .innerJoin(products, and(eq(products.companyId, salesLines.companyId), eq(products.id, salesLines.productId)))
    .where(and(eq(salesLines.companyId, companyId), isNotNull(products.salesPersonId), gte(invoices.invoiceDate, from), lte(invoices.invoiceDate, to)))
    .groupBy(products.salesPersonId);
  return new Map(rows.map((r) => [r.id!, Number(r.sales)]));
}

/** The distinct supplier names in the product list, for choosing which suppliers a person represents. */
export async function listSupplierNames(db: Db, companyId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ name: products.supplierName })
    .from(products)
    .where(and(eq(products.companyId, companyId), isNotNull(products.supplierName)))
    .orderBy(asc(products.supplierName));
  return rows.map((r) => r.name!).filter((n) => n.trim() !== "");
}

/** The date of the first invoice of each account a person holds (null for an account with no invoice), from the sales that were imported. */
export async function firstInvoiceDatesOfAccounts(db: Db, companyId: string, personId: string): Promise<(string | null)[]> {
  const rows = await db
    .select({ first: sql<string | null>`min(${invoices.invoiceDate})::text` })
    .from(customers)
    .leftJoin(invoices, and(eq(invoices.companyId, customers.companyId), eq(invoices.customerId, customers.id)))
    .where(and(eq(customers.companyId, companyId), eq(customers.salesPersonId, personId)))
    .groupBy(customers.id);
  return rows.map((r) => r.first);
}

export type VisitRow = { id: string; visitedOn: string; customerName: string | null; customerCode: string | null; note: string | null; recordedBy: string | null };

/** A person's most recent visits, newest first. */
export async function listVisits(db: Db, companyId: string, personId: string, limit = 20): Promise<VisitRow[]> {
  const rows = await db
    .select({ id: salesVisits.id, visitedOn: sql<string>`${salesVisits.visitedOn}::text`, customerName: customers.name, customerCode: customers.code, note: salesVisits.note, recordedBy: salesVisits.recordedBy })
    .from(salesVisits)
    .leftJoin(customers, and(eq(customers.companyId, salesVisits.companyId), eq(customers.id, salesVisits.customerId)))
    .where(and(eq(salesVisits.companyId, companyId), eq(salesVisits.salesPersonId, personId)))
    .orderBy(desc(salesVisits.visitedOn), desc(salesVisits.createdAt))
    .limit(limit);
  return rows;
}

/** How many visits a person made between two dates, both included. */
export async function countVisits(db: Db, companyId: string, personId: string, from: string, to: string): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(salesVisits)
    .where(and(eq(salesVisits.companyId, companyId), eq(salesVisits.salesPersonId, personId), gte(salesVisits.visitedOn, from), lte(salesVisits.visitedOn, to)));
  return r?.n ?? 0;
}

/** Writes down one visit. The customer, when given, must be one of this company's customers. */
export async function addVisit(db: Db, input: { companyId: string; personId: string; form: VisitForm; today: string; by: string }): Promise<SalesResult> {
  if (!isUuid(input.personId)) return { ok: false, error: NOT_FOUND };
  const v = cleanVisit(input.form, input.today);
  if (!v.ok) return v;
  const [p] = await db.select({ id: salesPeople.id }).from(salesPeople).where(and(eq(salesPeople.companyId, input.companyId), eq(salesPeople.id, input.personId))).limit(1);
  if (!p) return { ok: false, error: NOT_FOUND };
  if (v.value.customerId !== null) {
    if (!isUuid(v.value.customerId)) return { ok: false, error: ACCOUNT_NOT_FOUND };
    const [c] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.companyId, input.companyId), eq(customers.id, v.value.customerId))).limit(1);
    if (!c) return { ok: false, error: ACCOUNT_NOT_FOUND };
  }
  const [row] = await db
    .insert(salesVisits)
    .values({ companyId: input.companyId, salesPersonId: input.personId, customerId: v.value.customerId, visitedOn: v.value.visitedOn, note: v.value.note, recordedBy: input.by })
    .returning({ id: salesVisits.id });
  return { ok: true, id: row!.id };
}

/** Removes a visit that was written down by mistake. */
export async function removeVisit(db: Db, input: { companyId: string; visitId: string }): Promise<SalesResult> {
  if (!isUuid(input.visitId)) return { ok: false, error: "That visit was not found." };
  const gone = await db.delete(salesVisits).where(and(eq(salesVisits.companyId, input.companyId), eq(salesVisits.id, input.visitId))).returning({ id: salesVisits.id });
  return gone.length ? { ok: true, id: input.visitId } : { ok: false, error: "That visit was not found." };
}
