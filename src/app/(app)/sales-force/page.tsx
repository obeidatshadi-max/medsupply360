import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { windowEnd } from "@/core/freshness";
import { canManageSalesForce, canSeeSalesForce } from "@/core/permissions";
import { TARGET_WORD, targetProgress, type TargetStatus } from "@/core/sales-force";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";
import { companyDataSummary } from "@/lib/company-data-summary";
import { dateRange, jod, pct } from "@/lib/format";
import { listSalesPeople, listSupplierNames, salesByPerson } from "@/server/services/sales-force";
import { AddPersonForm } from "./person-forms";

export const metadata: Metadata = { title: "Sales force" };

const TONE: Record<TargetStatus, string> = { on: "text-brand", behind: "text-warn", far: "text-bad", none: "text-muted" };

export default async function SalesForcePage() {
  const user = await requireUser();
  if (user.guest) {
    return <PageHeading eyebrow="Sales force" title="Sales force" sub="Please sign in with a company account to see this page." />;
  }
  if (!canSeeSalesForce(user.role)) {
    return <PageHeading eyebrow="Sales force" title="Sales force" sub="Only the company owner and administrators can open this page." />;
  }
  const db = getDb();
  const d = await companyDataSummary(user.companyId);
  const to = windowEnd(businessToday(), d.latestInvoice);
  const from = `${to.slice(0, 4)}-01-01`;
  const [people, sales, suppliers] = await Promise.all([listSalesPeople(db, user.companyId), salesByPerson(db, user.companyId, from, to), listSupplierNames(db, user.companyId)]);
  const manage = canManageSalesForce(user.role);

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow={`${user.companyName} · Sales force`}
        title="Sales force"
        sub="Your sales team: who sells which supplier's products, which customer accounts and tenders each person holds, and what you expect of them. Assign products from Products & suppliers and tenders from each tender."
      />
      {manage ? <AddPersonForm supplierOptions={suppliers} /> : null}

      {people.length === 0 ? (
        <p className="rounded-lg border border-line bg-white p-5 text-sm text-muted">{manage ? "No one yet. Add your first sales person above." : "The owner has not added the sales force yet."}</p>
      ) : (
        <section aria-label="Sales force">
          <p className="mb-2 text-xs text-muted">
            Sales are the net sales (without tax, after returns) on each person&rsquo;s accounts, {dateRange(from, to)}, year to date. The target so far is the monthly target times the months passed.
          </p>
          <div className="overflow-x-auto rounded-lg border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Person</th>
                  <th className="px-3 py-2 font-medium">Suppliers</th>
                  <th className="px-3 py-2 text-right font-medium">Products</th>
                  <th className="px-3 py-2 text-right font-medium">Accounts</th>
                  <th className="px-3 py-2 text-right font-medium">Tenders</th>
                  <th className="px-3 py-2 font-medium">Expected</th>
                  <th className="px-3 py-2 font-medium">Sales, year to date</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => {
                  const ytd = sales.get(p.id) ?? 0;
                  const tp = targetProgress(ytd, p.monthlySalesTarget, to);
                  return (
                    <tr key={p.id} className="border-t border-line align-top">
                      <td className="px-3 py-2">
                        <Link href={`/sales-force/${p.id}`} className="font-medium underline decoration-line underline-offset-2 hover:decoration-brand">
                          {p.name}
                        </Link>
                        {p.email ? <span className="block text-xs text-muted">{p.email}</span> : null}
                        {!p.active ? <span className="block text-xs text-bad">Turned off</span> : null}
                      </td>
                      <td className="px-3 py-2 text-xs">{p.supplierNames.length ? p.supplierNames.join(", ") : <span className="text-muted">—</span>}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.products}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.accounts}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.tenders}</td>
                      <td className="px-3 py-2 text-xs">
                        {p.monthlySalesTarget === null && p.newAccountsTarget === null && p.visitsPerWeek === null ? (
                          <span className="text-muted">Not set</span>
                        ) : (
                          <>
                            {p.monthlySalesTarget !== null ? <span className="block">{jod(p.monthlySalesTarget)} a month</span> : null}
                            {p.newAccountsTarget !== null ? <span className="block">{p.newAccountsTarget} new account{p.newAccountsTarget === 1 ? "" : "s"} a month</span> : null}
                            {p.visitsPerWeek !== null ? <span className="block">{p.visitsPerWeek} visit{p.visitsPerWeek === 1 ? "" : "s"} a week</span> : null}
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="tabular-nums">{p.accounts === 0 ? "—" : jod(ytd)}</span>
                        {tp.ratio !== null && p.accounts > 0 ? (
                          <span className={`block text-xs ${TONE[tp.status]}`}>
                            {pct(tp.ratio)} of target so far · {TARGET_WORD[tp.status]}
                          </span>
                        ) : (
                          <span className="block text-xs text-muted">{p.accounts === 0 ? "No accounts assigned" : TARGET_WORD.none}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
