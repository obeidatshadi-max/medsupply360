import type { Metadata } from "next";
import { Glossary } from "@/components/glossary";
import { PageHeading } from "@/components/page-heading";
import { CONCENTRATION_LIMIT, GROWTH_THRESHOLD, MIN_SHARE, NOT_SET, THIN_PRODUCTS, nextStep, type AreaFigures } from "@/core/portfolio";
import { requireUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";
import { windowEnd } from "@/core/freshness";
import { companyDataSummary } from "@/lib/company-data-summary";
import { PeriodTag } from "@/components/period-tag";
import { companyPortfolio } from "@/lib/portfolio";
import { jod, pct, signedPct } from "@/lib/format";

export const metadata: Metadata = { title: "Products & suppliers" };

const tone = (a: AreaFigures) => (a.signal === "Growing" ? "text-brand" : a.signal === "Declining" ? "text-[#a44d42]" : "text-muted");

export default async function PortfolioPage() {
  const user = await requireUser();
  if (user.guest) {
    return <PageHeading eyebrow="Products & suppliers" title="Portfolio growth" sub="Please sign in with a company account to see this page. It uses the data you imported." />;
  }
  const d = await companyDataSummary(user.companyId);
  const p = await companyPortfolio(user.companyId, windowEnd(businessToday(), d.latestInvoice));
  if (!p) {
    return (
      <div>
        <PageHeading eyebrow={`${user.companyName} · Products & suppliers`} title="Portfolio growth" sub="You have not imported sales for this year or last year yet. Import products, customers and sales to see where demand is growing." />
        {user.role === "owner" ? (
          <a href="/imports" className="rounded-[7px] bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-[#125747]">
            Import data
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <PageHeading
        eyebrow={`${user.companyName} · Products & suppliers`}
        title="Portfolio growth"
        sub="Where demand is growing, by therapeutic area and customer type. Sales without tax, after taking off returns. This is a hint to look closer, not a forecast."
      />
      <PeriodTag from={p.from} to={p.to} label="This year" against={{ from: p.priorFrom, to: p.priorTo }} />
      {p.unclassifiedShare > 0.2 ? (
        <p className="mb-4 rounded-lg border border-line bg-white p-3 text-xs text-muted" role="note">
          {pct(p.unclassifiedShare)} of this year&rsquo;s sales are on products with no therapeutic area, so the picture below is not complete. Add an area to each product in the product list (column &ldquo;therapeutic area&rdquo;) and import the list again.
        </p>
      ) : null}

      <section aria-label="Where to look for more products">
        <h2 className="text-sm font-semibold">Growing areas where you have few products</h2>
        {p.lookHere.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No area is both growing and short of products right now.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {p.lookHere.map((a) => {
              const best = a.bySegment.find((s) => s.delta > 0);
              return (
                <li key={a.area} className="rounded-[9px] border border-line bg-white p-4 text-sm">
                  <b>{a.area}</b>: sales {signedPct(a.growth)} ({jod(a.delta)} more than last year), spread over {a.customers} customers.
                  {best ? ` Most of the increase is with ${best.segment} customers (${jod(best.delta)}).` : ""} Only {a.activeProducts} active product{a.activeProducts === 1 ? "" : "s"} from {a.suppliers} supplier{a.suppliers === 1 ? "" : "s"}.
                  <span className="mt-1 block text-xs text-muted">Check if another product or supplier could serve this demand. Confirm the need, the margin and the supplier fit before you act.</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label="Areas" className="mt-6">
        <h2 className="text-sm font-semibold">All areas</h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Therapeutic area</th>
                <th className="px-3 py-2 text-right font-medium">Sales</th>
                <th className="px-3 py-2 text-right font-medium">Share</th>
                <th className="px-3 py-2 text-right font-medium">Change vs last year</th>
                <th className="px-3 py-2 font-medium">What we see</th>
                <th className="px-3 py-2 text-right font-medium">Top customer</th>
                <th className="px-3 py-2 text-right font-medium">Products</th>
                <th className="px-3 py-2 font-medium">Suggested next step</th>
              </tr>
            </thead>
            <tbody>
              {p.areas.map((a) => (
                <tr key={a.area} className="border-t border-line align-top">
                  <td className="px-3 py-2">
                    {a.area}
                    {a.bySegment.length > 0 ? (
                      <span className="mt-0.5 block text-xs text-muted">
                        {a.bySegment.map((s) => `${s.segment} ${jod(s.sales)} (${signedPct(s.growth)})`).join(" · ")}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{jod(a.sales)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pct(a.share, 1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{signedPct(a.growth)}</td>
                  <td className={`px-3 py-2 ${tone(a)}`}>{a.signal}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.sales > 0 ? `${pct(a.topCustomerShare)} (${a.topCustomer})` : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {a.area === NOT_SET || a.activeProducts === null ? "—" : `${a.activeProducts} products, ${a.suppliers} supplier${a.suppliers === 1 ? "" : "s"}`}
                    {a.thinCoverage ? <span className="block text-xs text-muted">thin</span> : null}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">{nextStep(a)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-xs text-muted">
          Rules: &ldquo;Growing&rdquo; means sales are up at least {pct(GROWTH_THRESHOLD)} on the same dates last year. &ldquo;Declining&rdquo; means they are down at least that much. An area with less than {pct(MIN_SHARE)} of sales is too small to judge. If one customer buys more than{" "}
          {pct(CONCENTRATION_LIMIT)} of an area, we say the growth comes from that customer and do not call it a trend. We say you have few products in an area when you have fewer than {THIN_PRODUCTS} active products or only one supplier.
        </p>
      </section>
      <Glossary page="portfolio" />
    </div>
  );
}
