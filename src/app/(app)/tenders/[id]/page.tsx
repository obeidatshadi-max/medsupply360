import { AdvancedGate } from "@/components/advanced-gate";
import { levelAllows } from "@/core/level";
import { currentLevel } from "@/lib/level";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { canAccess, canEditGuarantees, canEditPayments, canEditTender, canMoveTender } from "@/core/permissions";
import { AUTHORITIES, LINE_LABEL, STAGE, STATUS_LABEL, backMove, closeReasonLabel, daysInStage, forwardMoves } from "@/core/tender-flow";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";
import { dayText, jod } from "@/lib/format";
import { erpFactsByInvoiceNo, listGuarantees, listInvoices } from "@/server/services/tender-finance";
import { hasAwardResult } from "@/core/tender-results-prefill";
import { archivedBidCount } from "@/server/services/tender-prices";
import { deliveryProgress } from "@/core/tender-deliveries";
import { listDeliveries } from "@/server/services/tender-deliveries";
import { listTenderItems } from "@/server/services/tender-items";
import { getTender } from "@/server/services/tenders";
import { valuesOf } from "../tender-fields";
import { listSalesPeople } from "@/server/services/sales-force";
import { DetailsForm } from "./details-form";
import { Deliveries } from "./deliveries";
import { Guarantees } from "./guarantees";
import { ItemsEditor, ItemsTable } from "./items";
import { MovePanel } from "./move-panel";
import { OwnerForm } from "./owner-form";
import { Payments } from "./payments";
import { PriceHistoryPanel } from "./price-history-panel";

export const metadata: Metadata = { title: "Tender" };

const when = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Amman", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

export default async function TenderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("tender");
  if (!levelAllows(await currentLevel(), user.role, "/tenders")) return <AdvancedGate title="Tenders" />;
  const { id } = await params;
  const found = await getTender(getDb(), user.companyId, id);
  if (!found) notFound();
  const { tender: t, history } = found;
  const [guarantees, invoices, items, deliveries] = await Promise.all([listGuarantees(getDb(), user.companyId, t.id), listInvoices(getDb(), user.companyId, t.id), listTenderItems(getDb(), user.companyId, t.id), listDeliveries(getDb(), user.companyId, t.id)]);
  // The ERP check reads receivables, which the tender and finance roles may not open, so only business roles get it.
  const erp = canAccess(user.role, "business") ? Object.fromEntries(await erpFactsByInvoiceNo(getDb(), user.companyId, invoices.map((i) => i.invoiceNo))) : null;

  const today = businessToday();
  // Moving to Delivered: the delivery date starts as the latest recorded delivery, and an unrecorded remainder is pointed out.
  const progress = deliveryProgress(t.contractValue, deliveries);
  const moveValues = { ...valuesOf(t), deliveredOn: t.deliveredOn ?? progress.lastDeliveredOn ?? "" };
  const deliveryNote = t.status === "contracted" && progress.outstanding !== null && progress.outstanding > 0 && progress.count > 0 ? `Deliveries recorded so far cover ${progress.percent}% of the contract; ${jod(progress.outstanding)} is not recorded as delivered.` : null;
  const authority = AUTHORITIES.find((a) => a.code === t.authority)!;
  const moves = [
    ...forwardMoves(t.status).map((to) => ({ to, back: false })),
    ...(backMove(t.status) ? [{ to: backMove(t.status)!, back: true }] : []),
  ].filter((m) => canMoveTender(user.role, t.status, m.to));

  const facts: [string, string][] = [
    ["Authority", `${t.authority} · ${authority.name}`],
    ["Owner", t.ownerName ?? "Not assigned yet"],
    ["Tender number", t.tenderNo ?? "—"],
    ["Products", LINE_LABEL[t.productLine]],
    ["Estimated value", t.estimatedValue === null ? "—" : jod(t.estimatedValue)],
    ["Submission deadline", t.deadline ? dayText(t.deadline) : "—"],
    ["Bid opening", t.bidOpeningDate ? dayText(t.bidOpeningDate) : "—"],
    ["Date submitted", t.submittedOn ? dayText(t.submittedOn) : "—"],
    ["Expected award date", t.expectedAwardDate ? dayText(t.expectedAwardDate) : "—"],
    ["Our bid", t.bidValue === null ? "—" : jod(t.bidValue)],
    ...(t.winnerName || t.winningPrice !== null ? ([["Winner", `${t.winnerName ?? "Not recorded"}${t.winningPrice === null ? "" : ` · ${jod(t.winningPrice)}`}`]] as [string, string][]) : []),
    ["Award amount", t.awardAmount === null ? "—" : jod(t.awardAmount)],
    ["Contract", t.contractNo ? `${t.contractNo}${t.contractValue === null ? "" : ` · ${jod(t.contractValue)}`}` : "—"],
    ["Payment terms", t.paymentTermsDays === null ? "—" : `${t.paymentTermsDays} days after the invoice date`],
    ["Delivered", t.deliveredOn ? dayText(t.deliveredOn) : "—"],
  ];

  return (
    <div className="space-y-6">
      <PageHeading eyebrow={`${user.companyName} · Tenders`} title={t.title} sub={`${t.authority}${t.tenderNo ? ` · ${t.tenderNo}` : ""}`} />
      <p className="text-sm">
        <Link href="/tenders" className="underline underline-offset-2">
          ← All tenders
        </Link>
      </p>

      <section aria-label="Where this tender stands" className="rounded-lg border border-line bg-white p-5">
        <p className="text-xs text-muted">
          Stage {STAGE[t.status].no} of 10 · {STAGE[t.status].name}
        </p>
        <p className="mt-1 text-2xl font-medium tracking-[-0.5px]">{STATUS_LABEL[t.status]}</p>
        <p className="mt-1 text-xs text-muted">
          {daysInStage(t.statusChangedAt, today)} days in this stage · since {when.format(t.statusChangedAt)} Jordan time
        </p>
        {t.closeReasonCode || t.closeReason ? (
          <p className="mt-3 text-sm">
            Reason: {[closeReasonLabel(t.closeReasonCode), t.closeReason].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-3">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        {t.notes ? <p className="mt-4 whitespace-pre-line text-sm text-muted">{t.notes}</p> : null}
      </section>

      {user.role === "owner" ? <OwnerForm tenderId={t.id} currentId={t.ownerId} choices={await listSalesPeople(getDb(), user.companyId)} /> : null}
      {moves.length > 0 || canEditTender(user.role) ? <MovePanel tenderId={t.id} status={t.status} values={moveValues} moves={moves} deliveryNote={deliveryNote} /> : null}
      {canEditTender(user.role) ? <DetailsForm tenderId={t.id} values={valuesOf(t)} /> : null}
      {canEditTender(user.role) ? <ItemsEditor tenderId={t.id} items={items} /> : <ItemsTable items={items} />}

      {hasAwardResult(t.status) ? <PriceHistoryPanel tenderId={t.id} archived={await archivedBidCount(getDb(), user.companyId, t.authority, t.tenderNo)} hasNumber={t.tenderNo !== null} canUpload={canAccess(user.role, "tender")} itemCount={items.length} /> : null}

      {["contracted", "delivered", "collected"].includes(t.status) ? (
        <Deliveries tenderId={t.id} rows={deliveries} contractValue={t.contractValue} canEdit={canEditTender(user.role)} canAdd={["contracted", "delivered"].includes(t.status)} />
      ) : null}

      <Guarantees tenderId={t.id} rows={guarantees} today={today} canEdit={canEditGuarantees(user.role)} />
      <Payments tenderId={t.id} rows={invoices} erp={erp} termsDays={t.paymentTermsDays} today={today} canLookupErp={erp !== null && canEditPayments(user.role)} canEdit={canEditPayments(user.role)} canAdd={["contracted", "delivered", "collected"].includes(t.status)} />

      <section aria-label="History">
        <h2 className="text-sm font-semibold">History</h2>
        <ol className="mt-2 space-y-2 text-sm">
          {[...history].reverse().map((h) => (
            <li key={h.id} className="rounded-lg border border-line bg-white px-4 py-3">
              <p>
                <b>{h.fromStatus ? `${STATUS_LABEL[h.fromStatus]} → ${STATUS_LABEL[h.toStatus]}` : STATUS_LABEL[h.toStatus]}</b>
              </p>
              <p className="text-xs text-muted">
                {when.format(h.at)} Jordan time
                {h.submittedBy ? ` · ${h.submittedBy}${h.by ? ` (account: ${h.by})` : ""}` : h.by ? ` · ${h.by}` : ""}
              </p>
              {h.note ? <p className="mt-1">{h.note}</p> : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
