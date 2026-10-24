import { and, eq, inArray } from "drizzle-orm";
import { buildTenderOverview, type TenderOverview } from "@/core/tender-overview";
import type { Db } from "@/db/import-writer";
import { tenderGuarantees, tenderInvoices, tenderStatusLog } from "@/db/schema";
import { businessToday } from "@/lib/business-date";
import { listTenders } from "@/server/services/tenders";

/** Everything the owner's tender overview shows, for one company. Reads only that company's rows. */
export async function companyTenderOverview(db: Db, companyId: string, today: string): Promise<TenderOverview> {
  const [tenders, guarantees, invoices, log] = await Promise.all([
    listTenders(db, companyId),
    db.select({ tenderId: tenderGuarantees.tenderId, amount: tenderGuarantees.amount, expiresOn: tenderGuarantees.expiresOn, returnedOn: tenderGuarantees.returnedOn }).from(tenderGuarantees).where(eq(tenderGuarantees.companyId, companyId)),
    db.select({ tenderId: tenderInvoices.tenderId, amount: tenderInvoices.amount, collected: tenderInvoices.collectedAmount }).from(tenderInvoices).where(eq(tenderInvoices.companyId, companyId)),
    db
      .select({ tenderId: tenderStatusLog.tenderId, toStatus: tenderStatusLog.toStatus, at: tenderStatusLog.createdAt })
      .from(tenderStatusLog)
      .where(and(eq(tenderStatusLog.companyId, companyId), inArray(tenderStatusLog.toStatus, ["submitted", "won", "lost"]))),
  ]);
  // The day a tender last entered a status, in Jordan time. The recorded submission date wins over the day it entered Submitted.
  const enteredOn = new Map<string, string>();
  for (const l of [...log].sort((a, b) => a.at.getTime() - b.at.getTime())) enteredOn.set(`${l.tenderId}:${l.toStatus === "submitted" ? "submitted" : "decided"}`, businessToday(l.at));
  return buildTenderOverview({
    today,
    tenders: tenders.map((t) => ({
      ...t,
      submittedOn: t.submittedOn ?? enteredOn.get(`${t.id}:submitted`) ?? null,
      decidedOn: t.status === "won" || t.status === "lost" || t.status === "contracted" || t.status === "delivered" || t.status === "collected" ? (enteredOn.get(`${t.id}:decided`) ?? null) : null,
    })),
    guarantees: guarantees.map((g) => ({ ...g, amount: Number(g.amount) })),
    invoices: invoices.map((i) => ({ ...i, amount: Number(i.amount), collected: Number(i.collected) })),
  });
}
