import { and, asc, eq, sql } from "drizzle-orm";
import { cleanItems, itemTotals, type ItemForm, type TenderItem } from "@/core/tender-items";
import type { Db } from "@/db/import-writer";
import { tenderItems, tenders } from "@/db/schema";

const num = (v: string | null): number | null => (v === null ? null : Number(v));
const money3 = (v: number | null) => (v === null ? null : v.toFixed(3));

/** A tender's item lines in order. Reads only that company's rows. */
export async function listTenderItems(db: Db, companyId: string, tenderId: string): Promise<TenderItem[]> {
  const rows = await db
    .select()
    .from(tenderItems)
    .where(and(eq(tenderItems.companyId, companyId), eq(tenderItems.tenderId, tenderId)))
    .orderBy(asc(tenderItems.lineNo));
  return rows.map((r) => ({ itemName: r.itemName, quantity: Number(r.quantity), unit: r.unit, estimatedUnitPrice: num(r.estimatedUnitPrice), ourUnitPrice: num(r.ourUnitPrice) }));
}

export type SaveItemsResult = { ok: true; count: number; bidValue: number | null; estimatedValue: number | null } | { ok: false; error: string };

/**
 * Replaces the whole list of item lines. When every line has our price the tender's bid value becomes the total, and when
 * every line has the authority's estimate the estimated value does too, so the tender and its lines never disagree. A total
 * that cannot be worked out (some line unpriced) leaves the value the tender already has.
 */
export async function saveTenderItems(db: Db, input: { companyId: string; tenderId: string; rows: ItemForm[] }): Promise<SaveItemsResult> {
  const cleaned = cleanItems(input.rows);
  if (!cleaned.ok) return cleaned;
  const [tender] = await db.select({ id: tenders.id }).from(tenders).where(and(eq(tenders.companyId, input.companyId), eq(tenders.id, input.tenderId))).limit(1);
  if (!tender) return { ok: false, error: "That tender was not found." };
  const totals = itemTotals(cleaned.items);
  await db.transaction(async (tx) => {
    await tx.delete(tenderItems).where(and(eq(tenderItems.companyId, input.companyId), eq(tenderItems.tenderId, input.tenderId)));
    if (cleaned.items.length > 0)
      await tx.insert(tenderItems).values(
        cleaned.items.map((i, n) => ({
          companyId: input.companyId,
          tenderId: input.tenderId,
          lineNo: n + 1,
          itemName: i.itemName,
          quantity: i.quantity.toFixed(3),
          unit: i.unit,
          estimatedUnitPrice: money3(i.estimatedUnitPrice),
          ourUnitPrice: money3(i.ourUnitPrice),
        })),
      );
    const set: Partial<typeof tenders.$inferInsert> = { updatedAt: sql`now()` as unknown as Date };
    if (totals.bid !== null) set.bidValue = money3(totals.bid);
    if (totals.estimated !== null) set.estimatedValue = money3(totals.estimated);
    await tx.update(tenders).set(set).where(and(eq(tenders.companyId, input.companyId), eq(tenders.id, input.tenderId)));
  });
  return { ok: true, count: cleaned.items.length, bidValue: totals.bid, estimatedValue: totals.estimated };
}
