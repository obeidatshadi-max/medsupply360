import Link from "next/link";

/** After the award: offers the Price history results file with this tender's known cells filled in, so only items and prices are typed. */
export function PriceHistoryPanel({ tenderId, archived, hasNumber, canUpload, itemCount }: { tenderId: string; archived: number; hasNumber: boolean; canUpload: boolean; itemCount: number }) {
  return (
    <section aria-label="Price history" className="space-y-2 rounded-lg border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold">Add the award result to Price history</h2>
      {archived > 0 ? (
        <p className="text-sm">
          Price history already holds <b>{archived}</b> bid{archived === 1 ? "" : "s"} for this tender. Upload a file again to correct or add bids.
        </p>
      ) : (
        <p className="text-sm text-muted">Not in Price history yet.</p>
      )}
      {hasNumber ? null : <p className="text-sm text-bad">This tender has no tender number. Add one in Details first: Price history matches tenders by authority and number.</p>}
      <p className="text-xs text-muted">
        The file comes with the authority, tender number, title, award date, our company and the result already filled in.{" "}
        {itemCount > 0
          ? `It has one row per item line (${itemCount}) with the quantity and our price, plus a row per item for the winner if one is recorded. Add the winner's prices from the award notice, then upload it.`
          : "Add one row per item and bidder (item, quantity, unit price), copying the filled cells down, then upload it. Item lines recorded on the tender are filled in for you."}
      </p>
      <div className="flex flex-wrap gap-2">
        <a href={`/tenders/${tenderId}/results-file`} className="rounded-[7px] border border-line bg-white px-3 py-2 text-sm font-semibold hover:border-brand">
          Download the prefilled file
        </a>
        {canUpload ? (
          <Link href="/imports/tenders" className="rounded-[7px] border border-line bg-white px-3 py-2 text-sm hover:border-brand">
            Upload it on the Tender department page
          </Link>
        ) : null}
      </div>
    </section>
  );
}
