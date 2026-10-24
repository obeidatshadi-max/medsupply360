import { AUTHORITIES } from "@/core/tender-flow";
import {
  BASIS_LABEL,
  OUTCOME_LABEL,
  areaSummary,
  coverageOf,
  gapDistribution,
  itemHistory,
  summarizeItems,
  type BidRow,
  type ItemSummary,
} from "@/core/tender-prices";
import { TENDER_RESULTS_GUIDE, type ColumnLevel } from "@/core/tender-results-guide";
import { addDays, dayText, jod, pct, signedPct } from "@/lib/format";

const card = "rounded-lg border border-line bg-white p-4";
const chip = (active: boolean) => `rounded-full border px-3 py-1 text-xs ${active ? "border-brand bg-brand text-brand-ink" : "border-line bg-white hover:border-brand"}`;
const SHOWN_ITEMS = 40;
const authorityName = (code: string) => AUTHORITIES.find((a) => a.code === code)?.name ?? code;

export interface PriceParams {
  authority: string;
  area: string;
  q: string;
  item: string;
}

export interface PriceHistoryProps {
  rows: BidRow[];
  /** Today, YYYY-MM-DD: the "last 12 months" window ends here. */
  asOf: string;
  /** Where this page lives, for the filter links. */
  basePath: string;
  params: PriceParams;
  /** Where the owner imports files. Null for people who cannot import. */
  importHref: string | null;
  /** Download links for the empty template and the made-up sample file. */
  downloads: { template: string; sample: string } | null;
  /** True on the sample page, which says its data is made up. */
  sample?: boolean;
}

const LEVEL_LABEL: Record<ColumnLevel, string> = { required: "Needed", helpful: "Helps a lot", optional: "Optional" };

/**
 * The price history screen, top to bottom: how to add data, what the data covers, what was paid per item, how close we
 * lose, and where the money goes by therapeutic area. One component serves the live page and the sample page, so the
 * two cannot show different things.
 */
export function PriceHistory({ rows, asOf, basePath, params, importHref, downloads, sample = false }: PriceHistoryProps) {
  if (rows.length === 0) {
    return (
      <div className="space-y-5">
        <GetStarted importHref={importHref} downloads={downloads} />
        <FileGuide />
      </div>
    );
  }

  const area = (r: BidRow) => r.therapeuticArea ?? "Not classified";
  const authorities = [...new Set(rows.map((r) => r.authority))].sort();
  const areas = [...new Set(rows.map(area))].sort();
  const needle = params.q.trim().toLowerCase();
  const filtered = rows.filter(
    (r) => (!params.authority || r.authority === params.authority) && (!params.area || area(r) === params.area) && (!needle || r.itemName.toLowerCase().includes(needle)),
  );

  const href = (next: Partial<PriceParams>) => {
    const merged = { ...params, item: "", ...next };
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  const coverage = coverageOf(filtered);
  const items = summarizeItems(filtered);
  const selected = params.item ? items.find((i) => i.itemKey === params.item) : undefined;
  const gaps = gapDistribution(filtered);
  const areaRows = areaSummary(filtered, addDays(asOf, -365));
  const share = (n: number) => (coverage.items === 0 ? "—" : pct(n / coverage.items));

  return (
    <div className="space-y-6">
      {sample ? (
        <p className="rounded-md border border-line bg-white px-3 py-2 text-xs text-muted">
          Made-up data: the authority names are real, but every tender number, price, quantity and rival company is invented. In the live app this page fills from the tender results you import.
        </p>
      ) : null}

      <section aria-label="Filter" className="space-y-2">
        <div className="flex flex-wrap gap-2" aria-label="Filter by authority">
          <a href={href({ authority: "" })} className={chip(!params.authority)}>
            All authorities
          </a>
          {authorities.map((a) => (
            <a key={a} href={href({ authority: a })} className={chip(params.authority === a)} title={authorityName(a)}>
              {a}
            </a>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Filter by therapeutic area">
          <a href={href({ area: "" })} className={chip(!params.area)}>
            All areas
          </a>
          {areas.map((a) => (
            <a key={a} href={href({ area: a })} className={chip(params.area === a)}>
              {a}
            </a>
          ))}
        </div>
        <form action={basePath} method="get" className="flex flex-wrap items-center gap-2">
          {params.authority ? <input type="hidden" name="authority" value={params.authority} /> : null}
          {params.area ? <input type="hidden" name="area" value={params.area} /> : null}
          <input type="search" name="q" defaultValue={params.q} placeholder="Find an item…" aria-label="Find an item" className="w-64 rounded-md border border-line bg-white px-3 py-1.5 text-sm" />
          <button type="submit" className="rounded-md border border-brand px-3 py-1.5 text-sm font-semibold text-brand">
            Find
          </button>
          {params.q ? (
            <a href={href({ q: "" })} className="text-xs text-muted underline">
              Clear
            </a>
          ) : null}
        </form>
      </section>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-line bg-white p-5 text-sm text-muted">Nothing in the price history matches this filter.</p>
      ) : (
        <>
          <section aria-label="What the history covers" className="space-y-3">
            <h2 className="text-sm font-semibold">What this is based on</h2>
            <div className="grid grid-cols-2 gap-[10px] min-[1000px]:grid-cols-4">
              <Tile label="Tenders" value={String(coverage.tenders)} />
              <Tile label="Items" value={String(coverage.items)} />
              <Tile label="Bids recorded" value={String(coverage.bids)} />
              <Tile label="Period" value={coverage.firstDate && coverage.lastDate ? `${dayText(coverage.firstDate).replace(/^\d+ /, "")} to ${dayText(coverage.lastDate).replace(/^\d+ /, "")}` : "—"} small />
            </div>
            <p className="text-xs text-muted">
              The winner&rsquo;s price is known for {coverage.itemsWithWinnerPrice} of {coverage.items} items ({share(coverage.itemsWithWinnerPrice)}). Two or more bidders&rsquo; prices are known for{" "}
              {coverage.itemsWithBidderPrices} items ({share(coverage.itemsWithBidderPrices)}). Authorities that publish only the winner limit how far competitors can be compared.
              {coverage.bidsInOtherCurrency > 0 ? ` ${coverage.bidsInOtherCurrency} prices in other currencies are kept but not compared.` : ""}
            </p>
            <div className="overflow-x-auto rounded-lg border border-line bg-white">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Authority</th>
                    <th className="px-3 py-2 text-right font-medium">Tenders</th>
                    <th className="px-3 py-2 text-right font-medium">Items</th>
                    <th className="px-3 py-2 text-right font-medium">Winner&rsquo;s price known</th>
                    <th className="px-3 py-2 text-right font-medium">Bidders compared</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.byAuthority.map((a) => (
                    <tr key={a.authority} className="border-t border-line">
                      <td className="px-3 py-2">
                        <span className="font-medium">{a.authority}</span> <span className="text-xs text-muted">{authorityName(a.authority)}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{a.tenders}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{a.items}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{pct(a.itemsWithWinnerPrice / a.items)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{pct(a.itemsWithBidderPrices / a.items)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-label="Price by item" className="space-y-2">
            <h2 className="text-sm font-semibold">What was paid, item by item</h2>
            <p className="max-w-2xl text-xs text-muted">
              &ldquo;Typically paid&rdquo; is the middle of the winning prices. &ldquo;A sensible aim&rdquo; runs from the lower quarter of what was paid up to that middle. The last column says how many awards a row rests on: with fewer than three, treat the price as a hint, not a number to bid.
            </p>
            <ItemTable items={items.slice(0, SHOWN_ITEMS)} href={(key) => href({ item: key })} selectedKey={selected?.itemKey} />
            {items.length > SHOWN_ITEMS ? <p className="text-xs text-muted">Showing the {SHOWN_ITEMS} most tendered of {items.length} items. Use the filters or the search to narrow the list.</p> : null}
          </section>

          {selected ? <ItemDetail item={selected} rows={filtered} closeHref={href({ item: "" })} /> : null}

          <section aria-label="How close we lose" className="space-y-2">
            <h2 className="text-sm font-semibold">How close we lose</h2>
            {gaps.placed === 0 ? (
              <p className="text-sm text-muted">No bid of ours has both a stated result and a known winner&rsquo;s price yet, so this cannot be shown.</p>
            ) : (
              <>
                <p className="max-w-2xl text-xs text-muted">Each of our decided bids, placed by how far above the winning price it was. If most losses are within 10%, a small price move is worth testing.</p>
                <div className={`${card} space-y-2`}>
                  {gaps.buckets.map((b) => (
                    <div key={b.key} className="grid grid-cols-[minmax(0,16rem)_1fr_3rem] items-center gap-3 text-sm">
                      <span>{b.label}</span>
                      <div className="h-2 overflow-hidden rounded-full bg-canvas" aria-hidden>
                        <div className="h-full rounded-full bg-brand" style={{ width: `${(b.count / Math.max(1, ...gaps.buckets.map((x) => x.count))) * 100}%` }} />
                      </div>
                      <span className="text-right tabular-nums">{b.count}</span>
                    </div>
                  ))}
                  {gaps.notPlaced > 0 ? <p className="text-xs text-muted">{gaps.notPlaced} more of our bids could not be placed because our price or the winner&rsquo;s price is not known.</p> : null}
                </div>
              </>
            )}
          </section>

          <section aria-label="Therapeutic areas" className="space-y-2">
            <h2 className="text-sm font-semibold">Where the money went, last 12 months</h2>
            <p className="max-w-2xl text-xs text-muted">
              Awarded value is quantity times the winning price. Awards with a price but no quantity are counted separately and left out of the value, never guessed.
            </p>
            {areaRows.every((a) => a.awardedValue === 0) ? (
              <p className="text-sm text-muted">No award in the last 12 months has both a price and a quantity.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-line bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">Therapeutic area</th>
                      <th className="px-3 py-2 text-right font-medium">Items</th>
                      <th className="px-3 py-2 text-right font-medium">Awarded value</th>
                      <th className="px-3 py-2 text-right font-medium">Awarded to us</th>
                      <th className="px-3 py-2 text-right font-medium">Our share</th>
                      <th className="px-3 py-2 text-right font-medium">Left out (no quantity)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {areaRows.map((a) => (
                      <tr key={a.area} className="border-t border-line">
                        <td className="px-3 py-2">{a.area}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{a.items}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{jod(Math.round(a.awardedValue))}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{jod(Math.round(a.ourValue))}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{a.awardedValue === 0 ? "—" : pct(a.ourValue / a.awardedValue)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{a.valueUnknown}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {sample ? null : (
        <details className={card}>
          <summary className="cursor-pointer text-sm font-semibold">Add more results</summary>
          <div className="mt-3 space-y-4">
            <GetStarted importHref={importHref} downloads={downloads} compact />
            <FileGuide />
          </div>
        </details>
      )}
    </div>
  );
}

function Tile({ label, value, small = false }: { label: string; value: string; small?: boolean }) {
  return (
    <div className={card}>
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 font-medium tracking-[-0.6px] ${small ? "text-base" : "text-2xl"}`}>{value}</p>
    </div>
  );
}

function ItemTable({ items, href, selectedKey }: { items: ItemSummary[]; href: (key: string) => string; selectedKey: string | undefined }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Item</th>
            <th className="px-3 py-2 text-right font-medium">Tenders</th>
            <th className="px-3 py-2 text-right font-medium">Typically paid</th>
            <th className="px-3 py-2 text-right font-medium">A sensible aim</th>
            <th className="px-3 py-2 font-medium">Our bids</th>
            <th className="px-3 py-2 font-medium">Based on</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.itemKey} className={`border-t border-line align-top ${i.itemKey === selectedKey ? "bg-canvas" : ""}`}>
              <td className="px-3 py-2">
                <a href={href(i.itemKey)} className="font-medium underline decoration-line underline-offset-2 hover:decoration-brand">
                  {i.itemName}
                </a>
                {i.therapeuticArea ? <span className="block text-xs text-muted">{i.therapeuticArea}</span> : null}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{i.tenders}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {i.awardMedian === null ? "—" : jod(round(i.awardMedian))}
                {i.awardLow !== null && i.awardHigh !== null && i.awards > 1 ? <span className="block text-xs text-muted">{`${jod(round(i.awardLow))} to ${jod(round(i.awardHigh))}`}</span> : null}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{i.bandLow === null || i.bandHigh === null ? "—" : `${jod(round(i.bandLow))} to ${jod(round(i.bandHigh))}`}</td>
              <td className="px-3 py-2">
                {i.ourBids === 0 ? (
                  <span className="text-muted">No bid of ours</span>
                ) : (
                  <>
                    {i.ourMedianBid === null ? "price unknown" : `${jod(round(i.ourMedianBid))} typically`}
                    {i.ourGap !== null ? <span className="block text-xs text-muted">{`${signedPct(i.ourGap, 0)} against what was paid`}</span> : null}
                    <span className="block text-xs text-muted">{i.ourDecided === 0 ? "results not stated" : `won ${i.ourWins} of ${i.ourDecided}`}</span>
                  </>
                )}
              </td>
              <td className="px-3 py-2">
                <span className={i.basis === "thin" ? "text-gold" : i.basis === "none" ? "text-muted" : "text-brand"}>{BASIS_LABEL[i.basis]}</span>
                <span className="block text-xs text-muted">{i.awards} {i.awards === 1 ? "award" : "awards"}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ItemDetail({ item, rows, closeHref }: { item: ItemSummary; rows: BidRow[]; closeHref: string }) {
  const history = itemHistory(rows, item.itemKey);
  return (
    <section aria-label={`History of ${item.itemName}`} className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Every tender for {item.itemName}</h2>
        <a href={closeHref} className="text-xs text-muted underline">
          Close
        </a>
      </div>
      {item.lastAwardDate !== null && item.lastAwardPrice !== null ? (
        <p className="text-xs text-muted">
          Last awarded {dayText(item.lastAwardDate)} by {item.lastAwardAuthority} at {jod(round(item.lastAwardPrice))}.
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Awarded</th>
              <th className="px-3 py-2 font-medium">Authority</th>
              <th className="px-3 py-2 font-medium">Tender</th>
              <th className="px-3 py-2 text-right font-medium">Quantity</th>
              <th className="px-3 py-2 text-right font-medium">Bidders</th>
              <th className="px-3 py-2 font-medium">Winner</th>
              <th className="px-3 py-2 text-right font-medium">Winning price</th>
              <th className="px-3 py-2 text-right font-medium">Our price</th>
              <th className="px-3 py-2 font-medium">Our result</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={`${h.archiveId}-${h.tenderNo}`} className="border-t border-line align-top">
                <td className="px-3 py-2 tabular-nums">{dayText(h.awardDate)}</td>
                <td className="px-3 py-2">{h.authority}</td>
                <td className="px-3 py-2">{h.tenderNo}</td>
                <td className="px-3 py-2 text-right tabular-nums">{h.quantity === null ? "—" : h.quantity.toLocaleString("en-US")}</td>
                <td className="px-3 py-2 text-right tabular-nums">{h.bidders}</td>
                <td className="px-3 py-2">{h.winner ?? "not stated"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{h.winnerPrice === null ? "—" : jod(round(h.winnerPrice))}</td>
                <td className="px-3 py-2 text-right tabular-nums">{h.ourPrice === null ? "—" : jod(round(h.ourPrice))}</td>
                <td className="px-3 py-2">{h.ourOutcome === null ? "No bid" : OUTCOME_LABEL[h.ourOutcome]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Whole fils for display. */
const round = (n: number) => Math.round(n * 1000) / 1000;

function GetStarted({ importHref, downloads, compact = false }: { importHref: string | null; downloads: PriceHistoryProps["downloads"]; compact?: boolean }) {
  const btn = "inline-block rounded-md border border-brand px-3 py-1.5 text-sm font-semibold text-brand hover:bg-canvas";
  return (
    <section aria-label="How to add tender results" className={compact ? "" : card}>
      {compact ? null : <h2 className="text-sm font-semibold">No tender results yet</h2>}
      <p className="mt-1 max-w-2xl text-xs text-muted">
        This page fills from the award results the authorities publish, together with your own bids. Three steps, and a file can be partly filled: what is missing stays unknown, and the page says so.
      </p>
      <ol className="mt-3 grid gap-3 md:grid-cols-3">
        <li className="rounded-md border border-line p-3 text-sm">
          <p className="font-medium">1. Get the file</p>
          <p className="mt-1 text-xs text-muted">One row for each bidder on each item. Start from the empty template.</p>
          {downloads ? (
            <a href={downloads.template} className={`${btn} mt-2`} download>
              Download the template
            </a>
          ) : null}
        </li>
        <li className="rounded-md border border-line p-3 text-sm">
          <p className="font-medium">2. Fill it from the notices</p>
          <p className="mt-1 text-xs text-muted">Copy what the authority published. If only the winner is published, add one row for the winner and one for your own bid.</p>
        </li>
        <li className="rounded-md border border-line p-3 text-sm">
          <p className="font-medium">3. Import it</p>
          <p className="mt-1 text-xs text-muted">Use Check first: it shows what would load and what is wrong, and saves nothing.</p>
          {importHref ? (
            <a href={importHref} className={`${btn} mt-2`}>
              Open Import data
            </a>
          ) : (
            <p className="mt-2 text-xs text-muted">Only the company owner can import files.</p>
          )}
        </li>
      </ol>
      {downloads ? (
        <p className="mt-3 text-xs text-muted">
          To try it first: <a href={downloads.sample} download className="underline">download a made-up sample file</a> (about 760 rows over four years, invented companies and prices) and import it. The Check button shows how the page will look.
        </p>
      ) : null}
    </section>
  );
}

function FileGuide() {
  return (
    <section aria-label="What goes in the file" className={card}>
      <h2 className="text-sm font-semibold">What goes in the file</h2>
      <p className="mt-1 max-w-2xl text-xs text-muted">One row for each bidder on each item. Save it as CSV (UTF-8) from Excel. Headings can be spelled in other common ways; the importer shows which column it matched.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-2 pr-3 font-medium">Column</th>
              <th className="py-2 pr-3 font-medium">Needed?</th>
              <th className="py-2 pr-3 font-medium">What to put</th>
              <th className="py-2 font-medium">Example</th>
            </tr>
          </thead>
          <tbody>
            {TENDER_RESULTS_GUIDE.map((c) => (
              <tr key={c.column} className="border-t border-line align-top">
                <td className="py-2 pr-3 font-medium">{c.column}</td>
                <td className={`py-2 pr-3 ${c.level === "required" ? "text-brand" : "text-muted"}`}>{LEVEL_LABEL[c.level]}</td>
                <td className="py-2 pr-3">{c.note}</td>
                <td className="py-2 tabular-nums text-muted">{c.example}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
