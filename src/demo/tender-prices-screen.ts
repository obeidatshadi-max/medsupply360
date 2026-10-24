/**
 * The promotional demo's Price history screen, as HTML for demo/index.html. It shows the same made-up results as the
 * in-app sample (/sample/tender-prices) and reads every figure from the same tested rules (src/core/tender-prices.ts),
 * so the two cannot disagree. The demo has no database: importing is described, not shown.
 *
 * Any customer profile other than Sadaf sees neutral "Authority A-E" labels, as on the Tenders screen.
 */
import { AUTHORITIES, type AuthorityCode } from "@/core/tender-flow";
import { BASIS_LABEL, areaSummary, coverageOf, gapDistribution, summarizeItems, type BidRow } from "@/core/tender-prices";
import { addDays, dayText, jod, pct, signedPct } from "@/lib/format";
import { authorityLabel } from "./tender-screen";
import { DEMO_PRICES_AS_OF, demoBidRows } from "./tender-prices-demo";

export interface TenderPricesOptions {
  /** True for any profile other than the Sadaf preset. */
  generic: boolean;
  /** Search text from the demo's search box; it narrows the item list. */
  query?: string;
}

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const panel = (title: string, sub: string, body: string) => `<section class="panel"><div class="panelhead"><div><h2>${title}</h2><p class="sub">${sub}</p></div></div>${body}</section>`;
const table = (headers: string[], rows: string[][], empty: string) =>
  `<div class="tablewrap"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${
    rows.length ? rows.map((r) => `<tr>${r.map((c, i) => `<td data-label="${esc(headers[i] ?? "")}">${c}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}" class="empty">${empty}</td></tr>`
  }</tbody></table></div>`;
const round = (n: number) => Math.round(n * 1000) / 1000;
const SHOWN_ITEMS = 12;

export function tenderPricesHtml({ generic, query }: TenderPricesOptions): string {
  const rows: BidRow[] = demoBidRows().map((r) => ({ ...r, authority: authorityLabel(r.authority as AuthorityCode, generic) }));
  const needle = (query ?? "").trim().toLowerCase();
  const filtered = needle ? rows.filter((r) => r.itemName.toLowerCase().includes(needle) || (r.therapeuticArea ?? "").toLowerCase().includes(needle)) : rows;
  const coverage = coverageOf(filtered);
  const items = summarizeItems(filtered);
  const gaps = gapDistribution(filtered);
  const areas = areaSummary(filtered, addDays(DEMO_PRICES_AS_OF, -365));
  const share = (n: number) => (coverage.items === 0 ? "—" : pct(n / coverage.items));
  const name = (label: string) => (generic ? "sample public buyer" : (AUTHORITIES.find((a) => a.code === label)?.name ?? ""));

  const back = `<p class="mini"><button class="linkbtn" data-route="tenders">← Back to the tenders</button></p>`;
  const how = panel(
    "How it fills in the live app",
    "Award results from the authorities and your own bids are imported as one file: a row for each bidder on each item. A file can be partly filled; what is missing stays unknown and the page says so.",
    `<p class="mini">Made-up data: the tender numbers, prices, quantities and rival companies are invented. Five authorities publish in five different ways, which is why the coverage table below differs by authority.</p>`,
  );

  const tiles = `<div class="stats">${[
    ["Tenders", String(coverage.tenders)],
    ["Items", String(coverage.items)],
    ["Bids recorded", String(coverage.bids)],
    ["Period", coverage.firstDate && coverage.lastDate ? `${dayText(coverage.firstDate).replace(/^\d+ /, "")} to ${dayText(coverage.lastDate).replace(/^\d+ /, "")}` : "—"],
  ]
    .map(([l, v]) => `<div class="stat"><div class="label">${l}</div><div class="value" style="font-size:${l === "Period" ? 16 : 26}px">${esc(v)}</div></div>`)
    .join("")}</div>`;

  const covered = panel(
    "What this is based on",
    `The winner's price is known for ${coverage.itemsWithWinnerPrice} of ${coverage.items} items (${share(coverage.itemsWithWinnerPrice)}). Two or more bidders' prices are known for ${coverage.itemsWithBidderPrices} items (${share(coverage.itemsWithBidderPrices)}).`,
    tiles +
      table(
        ["Authority", "Tenders", "Items", "Winner's price known", "Bidders compared"],
        coverage.byAuthority.map((a) => [`<b>${esc(a.authority)}</b> <span class="cellsub">${esc(name(a.authority))}</span>`, String(a.tenders), String(a.items), pct(a.itemsWithWinnerPrice / a.items), pct(a.itemsWithBidderPrices / a.items)]),
        "Nothing matches the search.",
      ),
  );

  const itemRows = items.slice(0, SHOWN_ITEMS).map((i) => [
    `<b>${esc(i.itemName)}</b>${i.therapeuticArea ? `<span class="cellsub">${esc(i.therapeuticArea)}</span>` : ""}`,
    String(i.tenders),
    i.awardMedian === null ? "—" : `${jod(round(i.awardMedian))}${i.awardLow !== null && i.awardHigh !== null && i.awards > 1 ? `<span class="cellsub">${jod(round(i.awardLow))} to ${jod(round(i.awardHigh))}</span>` : ""}`,
    i.bandLow === null || i.bandHigh === null ? "—" : `${jod(round(i.bandLow))} to ${jod(round(i.bandHigh))}`,
    i.ourBids === 0
      ? "No bid of ours"
      : `${i.ourMedianBid === null ? "price unknown" : `${jod(round(i.ourMedianBid))} typically`}${i.ourGap !== null ? `<span class="cellsub">${signedPct(i.ourGap, 0)} against what was paid</span>` : ""}<span class="cellsub">${i.ourDecided === 0 ? "results not stated" : `won ${i.ourWins} of ${i.ourDecided}`}</span>`,
    `${BASIS_LABEL[i.basis]}<span class="cellsub">${i.awards} ${i.awards === 1 ? "award" : "awards"}</span>`,
  ]);
  const paid = panel(
    "What was paid, item by item",
    "“Typically paid” is the middle of the winning prices. “A sensible aim” runs from the lower quarter of what was paid up to that middle. With fewer than three awards, treat the price as a hint, not a number to bid.",
    table(["Item", "Tenders", "Typically paid", "A sensible aim", "Our bids", "Based on"], itemRows, "No item matches the search.") +
      (items.length > SHOWN_ITEMS ? `<p class="mini">Showing the ${SHOWN_ITEMS} most tendered of ${items.length} items. Use the search box to find another.</p>` : ""),
  );

  const biggest = Math.max(1, ...gaps.buckets.map((b) => b.count));
  const close = panel(
    "How close we lose",
    "Each of our decided bids, placed by how far above the winning price it was. If most losses are within 10%, a small price move is worth testing.",
    gaps.placed === 0
      ? `<p class="mini">No bid of ours has both a stated result and a known winner's price in this selection.</p>`
      : gaps.buckets.map((b) => `<div class="kv"><span>${esc(b.label)}</span><b>${b.count}</b></div><div class="bar" aria-hidden="true" style="margin:2px 0 10px"><span style="width:${Math.round((b.count / biggest) * 100)}%"></span></div>`).join("") +
          (gaps.notPlaced > 0 ? `<p class="mini">${gaps.notPlaced} more of our bids could not be placed because our price or the winner's price is not known.</p>` : ""),
  );

  const money = panel(
    "Where the money went, last 12 months",
    "Awarded value is quantity times the winning price. Awards with a price but no quantity are counted separately and left out of the value, never guessed.",
    table(
      ["Therapeutic area", "Items", "Awarded value", "Awarded to us", "Our share"],
      areas.map((a) => [esc(a.area), String(a.items), jod(Math.round(a.awardedValue)), jod(Math.round(a.ourValue)), a.awardedValue === 0 ? "—" : pct(a.ourValue / a.awardedValue)]),
      "No award in the last 12 months has both a price and a quantity.",
    ),
  );

  return back + how + covered + paid + close + money;
}

/** CSV of the item table, for the demo's Export button. */
export function tenderPricesCsvRows(generic: boolean, query?: string): string[][] {
  const rows: BidRow[] = demoBidRows().map((r) => ({ ...r, authority: authorityLabel(r.authority as AuthorityCode, generic) }));
  const needle = (query ?? "").trim().toLowerCase();
  const items = summarizeItems(needle ? rows.filter((r) => r.itemName.toLowerCase().includes(needle)) : rows);
  return [
    ["Item", "Therapeutic area", "Tenders", "Awards", "Typically paid JOD", "Aim from JOD", "Aim to JOD", "Our bids", "Our median bid JOD"],
    ...items.map((i) => [i.itemName, i.therapeuticArea ?? "", String(i.tenders), String(i.awards), String(i.awardMedian ?? ""), String(i.bandLow ?? ""), String(i.bandHigh ?? ""), String(i.ourBids), String(i.ourMedianBid ?? "")]),
  ];
}
