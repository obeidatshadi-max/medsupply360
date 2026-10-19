import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { canEditGuarantees, canEditPayments, canEditTender, canMoveTender } from "@/core/permissions";
import { AUTHORITIES, LINE_LABEL, STAGE, STATUS_LABEL, backMove, daysInStage, forwardMoves } from "@/core/tender-flow";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";
import { dayText, jod } from "@/lib/format";
import { erpFactsByInvoiceNo, listGuarantees, listInvoices } from "@/server/services/tender-finance";
import { getTender } from "@/server/services/tenders";
import { valuesOf } from "../tender-fields";
import { listSalesPeople } from "@/server/services/sales-force";
import { DetailsForm } from "./details-form";
import { Guarantees } from "./guarantees";
import { MovePanel } from "./move-panel";
import { OwnerForm } from "./owner-form";
import { Payments } from "./payments";

export const metadata: Metadata = { title: "Tender" };

const when = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Amman", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

export default async function TenderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("tender");
  const { id } = await params;
  const found = await getTender(getDb(), user.companyId, id);
  if (!found) notFound();
  const { tender: t, history } = found;
  const [guarantees, invoices] = await Promise.all([listGuarantees(getDb(), user.companyId, t.id), listInvoices(getDb(), user.companyId, t.id)]);
  const erp = Object.fromEntries(await erpFactsByInvoiceNo(getDb(), user.companyId, invoices.map((i) => i.invoiceNo)));

  const today = businessToday();
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
    ["Our bid", t.bidValue === null ? "—" : jod(t.bidValue)],
    ["Award amount", t.awardAmount === null ? "—" : jod(t.awardAmount)],
    ["Contract", t.contractNo ? `${t.contractNo}${t.contractValue === null ? "" : ` · ${jod(t.contractValue)}`}` : "—"],
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
        {t.closeReason ? <p className="mt-3 text-sm">Reason: {t.closeReason}</p> : null}
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
      {moves.length > 0 || canEditTender(user.role) ? <MovePanel tenderId={t.id} status={t.status} values={valuesOf(t)} moves={moves} /> : null}
      {canEditTender(user.role) ? <DetailsForm tenderId={t.id} values={valuesOf(t)} /> : null}

      <Guarantees tenderId={t.id} rows={guarantees} today={today} canEdit={canEditGuarantees(user.role)} />
      <Payments tenderId={t.id} rows={invoices} erp={erp}canEdit={canEditPayments(user.role)} canAdd={["contracted", "delivered", "collected"].includes(t.status)} />

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
