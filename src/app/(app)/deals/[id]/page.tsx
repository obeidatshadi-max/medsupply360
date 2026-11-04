import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AddEntryForm, AddRebateForm, CheckOutcomesForm, ReviewEntryForm, StartActionForm } from "@/components/deal-forms";
import { DealHtml, DealStyle } from "@/components/deal-html";
import { DealReport } from "@/components/deal-report";
import { PageHeading } from "@/components/page-heading";
import { analyseDeal, dealNarrative } from "@/core/deal-margin";
import { DEAL_TERMS_HTML, dealCardsHtml, dealTabsHtml, esc, findingHtml, heldOutHtml, rebatesHtml, varianceHtml } from "@/core/deal-margin/html";
import { canEditDealMargin, canSeeDealMargin, homePath } from "@/core/permissions";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";
import { dayText } from "@/lib/format";
import { loadDealInput, loadDealInputs, loadOutcomes, loadPolicy } from "@/server/services/deal-margin";

export const metadata: Metadata = { title: "Deal margin" };

const VERDICT = { pending: "Not checked yet", resolved: "Fixed: the checks no longer flag this", improved: "Better", no_change: "Nothing has changed yet", worsened: "Worse" } as const;

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("business");
  if (user.guest) redirect("/login");
  if (!canSeeDealMargin(user.role)) redirect(homePath(user.role));
  const { id } = await params;
  const db = getDb();
  const input = await loadDealInput(db, user.companyId, id);
  if (!input) notFound();
  const today = businessToday();
  const [policy, outcomes, all] = await Promise.all([loadPolicy(db, user.companyId), loadOutcomes(db, user.companyId, id), loadDealInputs(db, user.companyId)]);
  const a = analyseDeal(input, policy, today);
  const edit = canEditDealMargin(user.role);
  const others = all.filter((d) => d.deal.id !== id).map((d) => ({ id: d.deal.id, ref: d.deal.ref }));
  const pending = a.views.classified.heldOut.filter((h) => h.reason === "pending_review" || h.reason === "wrong_deal");
  const tracked = new Map(outcomes.map((o) => [o.findingKey, o]));
  const story = dealNarrative(a.views, a.findings);

  return (
    <div>
      <DealStyle />
      <PageHeading eyebrow={`${user.companyName} · Deal margins · ${a.deal.kind === "tender" ? "Tender" : "Private sale"}`} title={`${a.deal.ref}: ${a.deal.title}`} sub={`${a.deal.customerName}. Profit here means sales minus the costs of this deal. It is not the company's net profit.`} />
      <p className="mb-3 text-xs">
        <Link href="/deals" className="underline">
          ← All deals
        </Link>
      </p>

      <DealHtml html={dealCardsHtml(a)} />
      <DealHtml html={`<ul class="dm-note">${story.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`} />

      <h2 className="mt-6 text-sm font-semibold">Margin waterfall</h2>
      <p className="text-xs text-muted">From the contract price down to the profit after earned rebates. Open any step to see the records behind it. A dashed or dotted bar is not backed by a confirmed transaction.</p>
      <DealReport html={dealTabsHtml(a, input.entries)} />

      <h2 className="mt-6 text-sm font-semibold">Why the margin moved</h2>
      <DealHtml html={varianceHtml(a)} />

      <h2 className="mt-6 text-sm font-semibold">Problems found and what to do</h2>
      <p className="text-xs text-muted">The checks are fixed: the same costs always give the same results. Anything about price, supplier terms or approvals is only a suggestion; a person decides.</p>
      {a.findings.length === 0 ? (
        <DealHtml html={`<p class="dm-info">The checks found no problem with this deal. Checks that need a company limit stay silent until the owner sets it.</p>`} />
      ) : (
        a.findings.map((f) => {
          const o = tracked.get(f.key);
          return (
            <div key={f.key}>
              <DealHtml html={findingHtml(f)} />
              {o ? (
                <p className="-mt-1 mb-2 rounded-lg border border-line bg-white p-3 text-xs">
                  <b>Action started {dayText(o.takenOn)}.</b> Outcome: {VERDICT[o.verdict]}
                  {o.checkedOn ? ` (checked ${dayText(o.checkedOn)})` : ""}. {o.explanation ?? "Press “Recalculate” to see whether the numbers got better. Marking an action done does not prove it worked."}
                  {o.profitRecoveredJod !== null ? ` Forecast profit moved by JOD ${o.profitRecoveredJod.toFixed(3)}.` : ""}
                </p>
              ) : edit ? (
                <StartActionForm dealId={a.deal.id} findingKey={f.key} title={f.title} today={today} />
              ) : null}
            </div>
          );
        })
      )}
      {edit && outcomes.length > 0 ? <CheckOutcomesForm dealId={a.deal.id} /> : null}

      <h2 className="mt-6 text-sm font-semibold">Supplier rebates</h2>
      <DealHtml html={rebatesHtml(a)} />

      <h2 className="mt-6 text-sm font-semibold">Costs left out of the numbers, and why</h2>
      <DealHtml html={heldOutHtml(a)} />
      {edit && pending.length > 0 ? (
        <section className="mt-3 space-y-2" aria-label="Review queue">
          <h3 className="text-sm font-semibold">Review queue ({pending.length})</h3>
          <p className="text-xs text-muted">These costs could not be tied to this deal with certainty. Nothing is counted until you decide.</p>
          {pending.map((h) => (
            <div key={h.entry.id} className="rounded-lg border border-line bg-white p-3 text-sm">
              <p>
                {h.entry.line.replace("_", " ")} · {h.entry.amount} {h.entry.currency} · {h.entry.source ? `${h.entry.source.docType} ${h.entry.source.docNo}` : "typed by hand"} · match {h.entry.confidence}
                {h.entry.note ? ` (${h.entry.note})` : ""}
              </p>
              <div className="mt-2">
                <ReviewEntryForm entryId={h.entry.id} otherDeals={others} />
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <DealHtml html={DEAL_TERMS_HTML} />
      {edit ? (
        <div className="mt-6 space-y-6">
          <AddEntryForm dealId={a.deal.id} />
          <AddRebateForm dealId={a.deal.id} />
        </div>
      ) : null}
    </div>
  );
}
