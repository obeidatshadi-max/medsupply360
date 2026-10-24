import { eq } from "drizzle-orm";
import { itemKeyOf, type BidOutcome, type BidRow } from "@/core/tender-prices";
import type { Db } from "@/db/import-writer";
import { tenderArchive, tenderArchiveLines, tenderBids } from "@/db/schema";

const num = (v: string | null) => (v === null ? null : Number(v));

/** Every bid in the company's price history, one row per bidder per item. Reads only that company's rows. */
export async function listBidRows(db: Db, companyId: string): Promise<BidRow[]> {
  const rows = await db
    .select({
      archiveId: tenderArchive.id,
      authority: tenderArchive.authority,
      tenderNo: tenderArchive.tenderNo,
      awardDate: tenderArchive.awardDate,
      lineId: tenderArchiveLines.id,
      productId: tenderArchiveLines.productId,
      itemName: tenderArchiveLines.itemName,
      therapeuticArea: tenderArchiveLines.therapeuticArea,
      quantity: tenderArchiveLines.quantity,
      bidder: tenderBids.bidder,
      isOwn: tenderBids.isOwn,
      unitPrice: tenderBids.unitPrice,
      currency: tenderBids.currency,
      outcome: tenderBids.outcome,
      awardedQuantity: tenderBids.awardedQuantity,
    })
    .from(tenderBids)
    .innerJoin(tenderArchiveLines, eq(tenderBids.lineId, tenderArchiveLines.id))
    .innerJoin(tenderArchive, eq(tenderArchiveLines.archiveId, tenderArchive.id))
    .where(eq(tenderBids.companyId, companyId));
  return rows.map((r) => ({
    archiveId: r.archiveId,
    authority: r.authority,
    tenderNo: r.tenderNo,
    awardDate: r.awardDate,
    lineId: r.lineId,
    itemKey: itemKeyOf(r.productId, r.itemName),
    itemName: r.itemName,
    therapeuticArea: r.therapeuticArea,
    quantity: num(r.quantity),
    bidder: r.bidder,
    isOwn: r.isOwn,
    unitPrice: num(r.unitPrice),
    currency: r.currency,
    outcome: r.outcome as BidOutcome,
    awardedQuantity: num(r.awardedQuantity),
  }));
}
