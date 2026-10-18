import { eq } from "drizzle-orm";
import { buildTenderOverview, type TenderOverview } from "@/core/tender-overview";
import type { Db } from "@/db/import-writer";
import { tenderGuarantees, tenderInvoices } from "@/db/schema";
import { listTenders } from "@/server/services/tenders";

/** Everything the owner's tender overview shows, for one company. Reads only that company's rows. */
export async function companyTenderOverview(db: Db, companyId: string, today: string): Promise<TenderOverview> {
  const [tenders, guarantees, invoices] = await Promise.all([
    listTenders(db, companyId),
    db.select({ tenderId: tenderGuarantees.tenderId, amount: tenderGuarantees.amount, expiresOn: tenderGuarantees.expiresOn, returnedOn: tenderGuarantees.returnedOn }).from(tenderGuarantees).where(eq(tenderGuarantees.companyId, companyId)),
    db.select({ tenderId: tenderInvoices.tenderId, amount: tenderInvoices.amount, collected: tenderInvoices.collectedAmount }).from(tenderInvoices).where(eq(tenderInvoices.companyId, companyId)),
  ]);
  return buildTenderOverview({
    today,
    tenders,
    guarantees: guarantees.map((g) => ({ ...g, amount: Number(g.amount) })),
    invoices: invoices.map((i) => ({ ...i, amount: Number(i.amount), collected: Number(i.collected) })),
  });
}
