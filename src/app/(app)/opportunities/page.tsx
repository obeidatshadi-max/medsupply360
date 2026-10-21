import type { Metadata } from "next";
import { CustomerLink } from "@/components/customer-link";
import { Glossary } from "@/components/glossary";
import { PageHeading } from "@/components/page-heading";
import { LEVEL_LABEL } from "@/core/opportunities";
import { MIN_ORDERS } from "@/core/predictions";
import { requireUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";
import { companyOpportunities } from "@/lib/opportunities";
import { jod } from "@/lib/format";
import { companyProductReorders } from "@/lib/product-reorders";
import { ProductReorders } from "@/components/product-reorders";
import { ActionList, AddActionForm } from "@/components/action-tracker";
import { canManageActions } from "@/core/permissions";
import { prefillFrom, sortActions, summarize } from "@/core/management-actions";
import { getDb } from "@/db/client";
import { listActions } from "@/server/services/management-actions";

export const metadata: Metadata = { title: "Management actions" };

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (user.guest) {
    return <PageHeading eyebrow="Management actions" title="Management actions" sub="Please sign in with a company account to see this page. It uses the data you imported." />;
  }
  const today = businessToday();
  const [r, productReorders, actionRows] = await Promise.all([
    companyOpportunities(user.companyId, today), companyProductReorders(user.companyId, today), listActions(getDb(), user.companyId),
  ]);
  const manage = canManageActions(user.role);
  const actions = sortActions(actionRows);
  const t = summarize(actions, today);
  const prefill = prefillFrom(await searchParams);
  const tracker = (
    <section aria-label="Management action tracker" className="mt-6">
      <h2 className="text-sm font-semibold">Management action tracker</h2>
      <p className="mt-1 text-xs text-muted">
        {t.open} open{t.overdue > 0 ? `, ${t.overdue} overdue` : ""} · {t.done} done · {t.departments} department{t.departments === 1 ? "" : "s"} with open work. Actions are company-wide. Done means a person confirmed it: it does not prove that money was recovered.
      </p>
      <ActionList actions={actions} today={today} manage={manage} />
      {manage ? (
        <div className="mt-4">
          <AddActionForm today={today} prefill={prefill} />
        </div>
      ) : null}
    </section>
  );
  if (!r) {
    return (
      <div>
        <PageHeading eyebrow={`${user.companyName} · Management actions`} title="Management actions" sub="You have not imported sales yet. Import products, customers and sales to see which customers should order again soon." />
        {user.role === "owner" ? (
          <a href="/imports" className="rounded-[7px] bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-[#125747]">
            Import data
          </a>
        ) : null}
        {tracker}
      </div>
    );
  }

  const late = r.reorders.filter((x) => x.forecast.level === "Overdue" || x.forecast.level === "Lapsed" || x.forecast.level === "Due soon");

  return (
    <div>
      <PageHeading
        eyebrow={`${user.companyName} · Management actions`}
        title="Management actions"
        sub={`Where to act first, on ${r.asOf}. Each customer appears once, with the biggest signal; other signals are only named, never added together.`}
      />

      {tracker}

      <section aria-label="Ranked opportunities" className="mt-6">
        <h2 className="text-sm font-semibold">Biggest opportunities</h2>
        {r.ranked.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing to report now: no customer is late to reorder and no payment is late.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">What we found</th>
                  <th className="px-3 py-2 text-right font-medium">Value</th>
                  <th className="px-3 py-2 font-medium">Also flagged</th>
                </tr>
              </thead>
              <tbody>
                {r.ranked.map((x) => (
                  <tr key={x.customerCode} className="border-t border-line">
                    <td className="px-3 py-2">
                      <CustomerLink code={x.customerCode} name={x.customerName} /> <span className="text-xs text-muted">{x.customerCode}</span>
                    </td>
                    <td className="px-3 py-2">
                      {x.kind} {x.estimated ? <span className="rounded bg-[#eef2ef] px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-muted">ESTIMATED</span> : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{jod(x.value)}</td>
                    <td className="px-3 py-2 text-xs text-muted">{x.alsoFlagged.length > 0 ? x.alsoFlagged.join(", ") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-1.5 text-xs text-muted">
          &ldquo;Late to reorder&rdquo; is an estimate. It shows the customer&rsquo;s average order in the last 12 months, because the usual time between their orders has passed. &ldquo;Collect late payment&rdquo; is a real amount that
          is past its due date{r.receivablesAsOf ? ` (unpaid invoices as of ${r.receivablesAsOf})` : ", but no unpaid-invoice file has been imported, so none is shown"}.
        </p>
      </section>

      <section aria-label="Reorder timing" className="mt-6">
        <h2 className="text-sm font-semibold">Customers who should order again soon, or are late</h2>
        <p className="mt-1 text-xs text-muted">
          ESTIMATE from each customer&rsquo;s own order history. We need at least {MIN_ORDERS} order days. {n(r.customersWithEnoughHistory)} customer{r.customersWithEnoughHistory === 1 ? " has" : "s have"} enough;{" "}
          {n(r.customersWithoutEnoughHistory)} {r.customersWithoutEnoughHistory === 1 ? "has" : "have"} too few orders, so we do not guess for {r.customersWithoutEnoughHistory === 1 ? "this customer" : "these customers"}.
        </p>
        {late.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No customer is due or late.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Usual days between orders</th>
                  <th className="px-3 py-2 font-medium">Last order</th>
                  <th className="px-3 py-2 font-medium">Expected</th>
                  <th className="px-3 py-2 text-right font-medium">Average order, last 12 months</th>
                  <th className="px-3 py-2 font-medium">How sure</th>
                </tr>
              </thead>
              <tbody>
                {late.slice(0, 25).map((x) => (
                  <tr key={x.customerCode} className="border-t border-line">
                    <td className="px-3 py-2">
                      <CustomerLink code={x.customerCode} name={x.customerName} /> <span className="text-xs text-muted">{x.customerCode}</span>
                    </td>
                    <td className="px-3 py-2">{LEVEL_LABEL[x.forecast.level]}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{x.forecast.cycleDays} d</td>
                    <td className="px-3 py-2 tabular-nums">{x.forecast.lastOrder}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {x.forecast.expectedNext} <span className="text-xs text-muted">{x.forecast.daysToNext < 0 ? `${-x.forecast.daysToNext} d late` : `in ${x.forecast.daysToNext} d`}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{jod(x.averageOrder)}</td>
                    <td className="px-3 py-2">{x.forecast.confidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <ProductReorders report={productReorders} />
      <Glossary page="opportunities" />
    </div>
  );
}

const n = (v: number) => v.toLocaleString("en-US");
