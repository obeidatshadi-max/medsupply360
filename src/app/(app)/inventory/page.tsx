import type { Metadata } from "next";
import { Glossary } from "@/components/glossary";
import { PageHeading } from "@/components/page-heading";
import { AssignActionLink } from "@/components/assign-action-link";
import { EXPIRY_WINDOW_DAYS, SLOW_COVER_DAYS } from "@/core/stock-risk";
import { requireUser } from "@/lib/auth/current-user";
import { companyStockRisk } from "@/lib/stock-risk";
import { jod } from "@/lib/format";

export const metadata: Metadata = { title: "Inventory & supply" };

const n = (v: number) => v.toLocaleString("en-US");

export default async function InventoryPage() {
  const user = await requireUser();
  if (user.guest) {
    return <PageHeading eyebrow="Inventory & supply" title="Stock risk" sub="Please sign in with a company account to see this page. It uses the data you imported." />;
  }
  const r = await companyStockRisk(user.companyId);
  if (!r) {
    return (
      <div>
        <PageHeading eyebrow={`${user.companyName} · Inventory & supply`} title="Stock risk" sub="You have not imported the stock file yet. Import it (file E06) to see slow stock and stock that may expire." />
        {user.role === "owner" ? (
          <a href="/imports" className="rounded-[7px] bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-[#125747]">
            Import data
          </a>
        ) : null}
      </div>
    );
  }

  const shortHistory = r.historyDays === null || r.historyDays < 90;
  const stats = [
    { label: "Stock value (owned)", value: jod(r.stockValue), note: `${n(r.rows)} stock rows as of ${r.asOf}` },
    { label: "Slow or unused stock", value: jod(r.slowValue), note: `Not used in ${r.windowDays} days, or more than ${SLOW_COVER_DAYS} days of stock left at the current speed of sales` },
    { label: "Expired stock", value: jod(r.expiredValue), note: "Past the expiry date, still in stock (at cost)" },
    { label: "Possible loss from expiry (estimate)", value: jod(r.expiryLossEstimate), note: `Stock we may not sell before it expires, in the next ${EXPIRY_WINDOW_DAYS} days` },
  ];

  return (
    <div>
      <PageHeading
        eyebrow={`${user.companyName} · Inventory & supply`}
        title="Stock risk"
        sub={`Only stock that you own, valued at what it cost to buy, from the stock file of ${r.asOf}. To measure demand, we use the average number of units sent to customers each day in the ${r.windowDays} days before that date.`}
      />
      {r.expiryLossEstimate > 0 || r.expiredValue > 0 ? (
        <p className="mb-4">
          <AssignActionLink role={user.role} title="Validate consumable expiry exposure" evidence={`Possible loss from expiry about ${jod(r.expiryLossEstimate)}, expired stock ${jod(r.expiredValue)} (stock file of ${r.asOf}). Confirm demand, lot dates and transfer options.`} responsible="Operations manager" label="Assign stock review →" />
        </p>
      ) : null}
      {shortHistory ? (
        <p className="mb-4 rounded-lg border border-line bg-white p-3 text-xs text-muted" role="note">
          {r.historyDays === null ? "No stock issues have been imported." : `Only ${r.historyDays} days of stock issues have been imported.`} These estimates need about 90 days or more of history to be reliable. Until then, a product may look unused when it is not.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-[10px] md:gap-[14px] min-[1000px]:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-[9px] border border-line bg-white p-[15px] md:p-[21px]">
            <p className="text-[11px] text-muted md:text-xs">{s.label}</p>
            <p className="my-2 text-2xl tracking-[-0.9px] md:text-[29px]">{s.value}</p>
            <p className="text-[10px] text-muted md:text-[11px]">{s.note}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        Slow stock and expiry loss can include the same products, so do not add them together.
        {r.rowsWithoutCost > 0 ? ` ${r.rowsWithoutCost} stock row${r.rowsWithoutCost === 1 ? " has" : "s have"} no unit cost, so ${r.rowsWithoutCost === 1 ? "it is" : "they are"} left out of every value above.` : ""}
      </p>

      <section aria-label="Slow stock" className="mt-6">
        <h2 className="text-sm font-semibold">Biggest slow or unused stock</h2>
        {r.slowProducts.length === 0 ? (
          <p className="mt-2 text-sm text-muted">None.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium">Line</th>
                  <th className="px-3 py-2 text-right font-medium">Quantity</th>
                  <th className="px-3 py-2 text-right font-medium">Value</th>
                  <th className="px-3 py-2 text-right font-medium">Days of stock left</th>
                </tr>
              </thead>
              <tbody>
                {r.slowProducts.map((p) => (
                  <tr key={p.productCode} className="border-t border-line">
                    <td className="px-3 py-2">
                      {p.productName} <span className="text-xs text-muted">{p.productCode}</span>
                    </td>
                    <td className="px-3 py-2">{p.line}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{n(p.quantity)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{jod(p.value)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{typeof p.coverDays === "number" ? `${n(p.coverDays)} d` : "No recent use"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="Expiry risk" className="mt-6">
        <h2 className="text-sm font-semibold">Batches that may expire before they are sold (estimate)</h2>
        {r.expiryRisks.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No batch will expire in the next {EXPIRY_WINDOW_DAYS} days with stock left over.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium">Batch</th>
                  <th className="px-3 py-2 font-medium">Expires</th>
                  <th className="px-3 py-2 text-right font-medium">Quantity</th>
                  <th className="px-3 py-2 text-right font-medium">Not sold by expiry</th>
                  <th className="px-3 py-2 text-right font-medium">Possible loss</th>
                </tr>
              </thead>
              <tbody>
                {r.expiryRisks.map((x) => (
                  <tr key={`${x.productCode}-${x.batch}`} className="border-t border-line">
                    <td className="px-3 py-2">
                      {x.productName} <span className="text-xs text-muted">{x.productCode}</span>
                    </td>
                    <td className="px-3 py-2">{x.batch || "—"}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {x.expiryDate} <span className="text-xs text-muted">{x.expired ? "expired" : `${x.daysLeft} d`}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{n(x.quantity)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{n(x.unsold)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{jod(x.estimatedLoss)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-1.5 text-xs text-muted">This is an estimate, not a confirmed loss. It assumes sales stay at the recent average and the batch that expires first is sold first.</p>
      </section>
      <Glossary page="inventory" />
    </div>
  );
}
