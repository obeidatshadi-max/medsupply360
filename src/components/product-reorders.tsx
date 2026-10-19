import { CustomerLink } from "@/components/customer-link";
import { LEVEL_LABEL } from "@/core/opportunities";
import type { companyProductReorders } from "@/lib/product-reorders";

export function ProductReorders({ report: r }: { report: Awaited<ReturnType<typeof companyProductReorders>> }) {
  const actions = r.items.filter((x) => x.forecast.level !== "On cycle");
  return (
    <section aria-label="Product reorder estimates" className="mt-6 rounded-lg border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold">Repeat consumables by customer and product</h2>
      <p className="mt-2 text-sm text-muted">
        Estimates as of {r.asOf}, using at least {r.minimumOrderDays} order days for the same customer and product.
        Buying another product does not reset this cycle. {r.eligiblePairs} pairs have enough history; {r.insufficientHistory} have too few orders.
      </p>
      <p className="mt-2 text-xs text-muted">
        Private accounts and consumables only. Tender purchases, unclassified accounts and equipment are excluded.
        History shown: {r.firstOrder ?? "none"} to {r.lastOrder ?? "none"}. Latest sales import: {r.latestImport ? r.latestImport.slice(0, 10) : "none"}.
        These dates do not establish complete exports. Missing exports can make an account look late.
      </p>
      {r.partialImport ? <p role="alert" className="mt-2 text-sm text-bad">The latest sales import rejected some rows. Reconcile the full export before acting on these estimates.</p> : null}
      {actions.length === 0 ? <p className="mt-3 text-sm">{r.eligiblePairs ? "No eligible product is due or late." : "No product pairs have enough eligible history yet. Import classified customers, products and historical sales to begin."}</p> : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr>
              <th className="px-3 py-2">Customer / product</th><th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Last order</th><th className="px-3 py-2">Expected date</th>
              <th className="px-3 py-2">Typical quantity</th><th className="px-3 py-2">Pattern consistency</th>
            </tr></thead>
            <tbody>{actions.slice(0, 25).map((x) => <tr key={JSON.stringify([x.customerCode, x.productCode])} className="border-t border-line">
              <td className="px-3 py-2"><CustomerLink code={x.customerCode} name={x.customerName} /> ({x.customerCode})<br />{x.productName} ({x.productCode})</td>
              <td className="px-3 py-2">{LEVEL_LABEL[x.forecast.level]}</td>
              <td className="px-3 py-2 tabular-nums">{x.forecast.lastOrder}</td>
              <td className="px-3 py-2 tabular-nums">{x.forecast.expectedNext}</td>
              <td className="px-3 py-2 tabular-nums">{x.typicalQuantity} {x.unit ?? "ERP units (unit not supplied)"}</td>
              <td className="px-3 py-2">{x.forecast.confidence === "Higher" ? "More regular" : "Less regular"}</td>
            </tr>)}</tbody>
          </table>
          {actions.length > 25 ? <p className="mt-2 text-xs text-muted">Showing 25 of {actions.length} due or late product pairs.</p> : null}
        </div>
      )}
      <p className="mt-3 text-xs text-muted">Historical median-cycle baseline. Forecast accuracy has not been validated. Typical quantity is past purchasing per order day, not a recommended purchase or a probability. Confirm the customer&apos;s current stock before following up.</p>
    </section>
  );
}
