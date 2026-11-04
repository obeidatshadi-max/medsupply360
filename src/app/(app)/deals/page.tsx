import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AddDealForm, ImportCostsForm, PolicyForm } from "@/components/deal-forms";
import { DealHtml, DealStyle } from "@/components/deal-html";
import { PageHeading } from "@/components/page-heading";
import { analysePortfolio, displayMargin } from "@/core/deal-margin";
import { DEAL_TERMS_HTML, portfolioHtml } from "@/core/deal-margin/html";
import { canEditDealMargin, canSeeDealMargin, homePath } from "@/core/permissions";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";
import { jod } from "@/lib/format";
import { loadDealInputs, loadPolicy } from "@/server/services/deal-margin";

export const metadata: Metadata = { title: "Deal margins" };

export default async function DealsPage() {
  const user = await requireUser("business");
  if (user.guest) return <PageHeading eyebrow="Deal margins" title="Deal margins" sub="Please sign in with a company account to see this page." />;
  if (!canSeeDealMargin(user.role)) redirect(homePath(user.role));
  const db = getDb();
  const today = businessToday();
  const [inputs, policy] = await Promise.all([loadDealInputs(db, user.companyId), loadPolicy(db, user.companyId)]);
  const { analyses, portfolio } = analysePortfolio(inputs, policy, today);
  const edit = canEditDealMargin(user.role);
  const policyValues = {
    minContributionMarginPct: String(policy.minContributionMarginPct ?? ""),
    maxDiscountPct: String(policy.maxDiscountPct ?? ""),
    costOverrunTolerancePct: String(policy.costOverrunTolerancePct ?? ""),
    deteriorationPp: String(policy.deteriorationPp ?? ""),
    financingRateAnnualPct: String(policy.financingRateAnnualPct ?? ""),
    roundingToleranceFils: String(policy.roundingToleranceFils),
  };

  return (
    <div>
      <DealStyle />
      <PageHeading
        eyebrow={`${user.companyName} · Deal margins`}
        title="Deal margins"
        sub="What each tender and private sale really earns after every cost of delivering it. The quoted, forecast and realized margins sit side by side. The numbers come only from the deals and costs entered or imported here."
      />
      <p className="mb-3 rounded-lg border border-line bg-white p-3 text-xs text-muted">
        Profit here means sales minus the costs of delivering the deal. It is not the company's net profit: overheads and income tax are not taken off. Costs come in by file upload only; a live link to Alpha has not been tested.
      </p>
      {analyses.length === 0 ? (
        <p className="rounded-lg border border-line bg-white p-4 text-sm text-muted">
          No deal yet. {edit ? "Add the first deal below, then import its costs from the ERP or type them in." : "The owner adds deals and their costs."} You can already test a price with the{" "}
          <Link href="/deals/simulate" className="underline">
            pre-bid simulator
          </Link>
          .
        </p>
      ) : (
        <>
          <DealHtml html={portfolioHtml(portfolio, policy)} />
          <section className="mt-6" aria-label="Deals">
            <h2 className="text-sm font-semibold">All deals</h2>
            <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-white">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Deal</th>
                    <th className="px-3 py-2 font-medium">Kind</th>
                    <th className="px-3 py-2 text-right font-medium">Quoted</th>
                    <th className="px-3 py-2 text-right font-medium">Forecast</th>
                    <th className="px-3 py-2 text-right font-medium">Realized</th>
                    <th className="px-3 py-2 text-right font-medium">Expected profit</th>
                    <th className="px-3 py-2 font-medium">Problems found</th>
                  </tr>
                </thead>
                <tbody>
                  {analyses.map((a) => (
                    <tr key={a.deal.id} className="border-t border-line">
                      <td className="px-3 py-2">
                        <Link href={`/deals/${a.deal.id}`} className="font-medium underline">
                          {a.deal.ref}
                        </Link>
                        <div className="text-xs text-muted">{a.deal.title}</div>
                        <div className="text-xs text-muted">{a.deal.customerName}</div>
                      </td>
                      <td className="px-3 py-2">{a.deal.kind === "tender" ? "Tender" : "Private"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{displayMargin(a.views.quoted.contributionMarginPct, "complete")}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{displayMargin(a.views.forecast.contributionMarginPct, a.views.forecast.completeness)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {displayMargin(a.views.realized.contributionMarginPct, a.views.realized.completeness)}
                        <div className="text-xs text-muted">{a.views.realized.state === "realized" ? "realized" : a.views.realized.state === "provisionally_realized" ? "provisional" : "open"}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{jod(a.views.forecast.contributionAfterRebates / 1000)}</td>
                      <td className="px-3 py-2 text-xs">{a.findings.length === 0 ? "none" : `${a.findings.length}: ${a.findings[0]!.title}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="mt-6" aria-label="Biggest issues">
            <h2 className="text-sm font-semibold">Biggest problems across all deals</h2>
            {portfolio.topFindings.length === 0 ? (
              <p className="mt-1 text-sm text-muted">The checks found no problem.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {portfolio.topFindings.map((f) => (
                  <li key={f.key}>
                    <Link href={`/deals/${f.dealId}`} className="underline">
                      {analyses.find((a) => a.deal.id === f.dealId)?.deal.ref}
                    </Link>
                    : {f.title} <span className="text-xs text-muted">· about JOD {f.impactJod.toFixed(3)} · {f.severity} · {f.kind === "incomplete_data" ? "data missing" : f.kind}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      <p className="mt-6 text-sm">
        <Link href="/deals/simulate" className="font-semibold underline">
          Test a price before you bid →
        </Link>
      </p>
      <DealHtml html={DEAL_TERMS_HTML} />
      {edit ? (
        <div className="mt-6 space-y-6">
          <PolicyForm values={policyValues} />
          <AddDealForm />
          <ImportCostsForm />
        </div>
      ) : null}
    </div>
  );
}
