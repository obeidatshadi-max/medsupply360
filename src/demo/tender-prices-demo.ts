/**
 * SYNTHETIC tender price history. Not real tenders, prices or companies. The authority names are the real ones, so the
 * screens look like the live ones; every tender number, price, quantity and rival company below is made up.
 *
 * It is built the way real files arrive: each authority "publishes" its results in a different way, and the rows go
 * through the real importer, so the sample page shows exactly what an import of this file would produce.
 *   MOH, KHCC  every bidder with a price
 *   DRMS       only the winner (plus our own sheet, which also knows our price)
 *   JUH        every bidder and the result, but prices only for the winner and for us
 *   KAUH       line totals only, no unit prices
 */
import { validateImport } from "@/core/import/validate";
import type { RowRef } from "@/core/import/specs";
import { TENDER_RESULTS_GUIDE, toCsv } from "@/core/tender-results-guide";
import { itemKeyOf, type BidOutcome, type BidRow } from "@/core/tender-prices";

/** The sample is "as of" the same day as the rest of the tender demonstration. */
export const DEMO_PRICES_AS_OF = "2026-10-24";

const OWN = "Sadaf Medical";
const RIVALS = ["Zahra Diagnostics", "Nabeel Lab Trading", "Orchard Biomed", "Cedar Med Supply", "Falcon Scientific", "Baraka Medical"];

/** Typical price (JOD, late 2022) and order size per item. */
const ITEMS = [
  { name: "Glucose test strips 50", area: "Diabetes", price: 4.2, qty: 20000, unit: "pack" },
  { name: "Lancets 100", area: "Diabetes", price: 0.9, qty: 15000, unit: "box" },
  { name: "HbA1c reagent kit", area: "Diabetes", price: 118, qty: 120, unit: "kit" },
  { name: "Troponin I rapid test", area: "Cardiology", price: 2.4, qty: 8000, unit: "test" },
  { name: "BNP reagent cartridge", area: "Cardiology", price: 9.5, qty: 1500, unit: "cartridge" },
  { name: "CBC analyzer reagent pack", area: "Haematology", price: 240, qty: 60, unit: "pack" },
  { name: "Haematology control solution", area: "Haematology", price: 36, qty: 90, unit: "set" },
  { name: "Blood gas cartridge", area: "Critical care", price: 7.8, qty: 4000, unit: "cartridge" },
  { name: "Urine test strips 100", area: "Nephrology", price: 3.1, qty: 6000, unit: "bottle" },
  { name: "Creatinine reagent", area: "Nephrology", price: 64, qty: 150, unit: "kit" },
  { name: "ELISA hepatitis B kit", area: "Infectious disease", price: 82, qty: 200, unit: "kit" },
  { name: "Pipette tips 1000", area: "Laboratory general", price: 11, qty: 900, unit: "bag" },
  { name: "Nitrile gloves medium", area: "Laboratory general", price: 2.6, qty: 30000, unit: "box" },
  { name: "Syringe 5ml", area: "Laboratory general", price: 0.035, qty: 400000, unit: "piece" },
] as const;

type Style = "full" | "winner_only" | "winner_and_ours" | "totals_only";
const AUTHORITY_STYLE: Record<string, { style: Style; factor: number; tenders: number }> = {
  MOH: { style: "full", factor: 0.97, tenders: 20 },
  KHCC: { style: "full", factor: 1.04, tenders: 14 },
  DRMS: { style: "winner_only", factor: 1.0, tenders: 14 },
  JUH: { style: "winner_and_ours", factor: 1.02, tenders: 12 },
  KAUH: { style: "totals_only", factor: 1.01, tenders: 10 },
};

/** Small deterministic random numbers, so the sample is the same every time. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * A shuffle that takes the same steps in every JavaScript engine. `sort(() => random - 0.5)` does not: engines order an
 * inconsistent comparator differently, which made the app and the promotional demo show different samples.
 */
function shuffled<T>(list: readonly T[], rnd: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const HEADER = TENDER_RESULTS_GUIDE.map((c) => c.column);

/** Rows of the sample file, in the template's column order. */
export function demoTenderResultRows(): string[][] {
  const rnd = lcg(20261024);
  const rows: string[][] = [];
  const START = "2022-11-15";
  const SPAN_DAYS = 1420; // up to mid-October 2026, never after the as-of date
  let serial = 0;

  for (const [authority, cfg] of Object.entries(AUTHORITY_STYLE)) {
    for (let t = 0; t < cfg.tenders; t++) {
      serial++;
      const date = addDays(START, Math.floor(((t + rnd() * 0.8) / cfg.tenders) * SPAN_DAYS));
      const years = (Date.parse(date) - Date.parse(START)) / (365.25 * 86400000);
      const tenderNo = `${authority}/${date.slice(0, 4)}/${String(serial).padStart(3, "0")}`;
      const title = `${["Laboratory supplies", "Diagnostic kits", "Point-of-care testing", "Annual reagent supply"][Math.floor(rnd() * 4)]} ${date.slice(0, 4)}`;
      const picked = shuffled(ITEMS, rnd).slice(0, 2 + Math.floor(rnd() * 3));

      for (const item of picked) {
        const reference = item.price * cfg.factor * (1 + 0.035 * years) * (0.94 + rnd() * 0.12);
        const qty = Math.max(1, Math.round(item.qty * (0.5 + rnd())));
        const bidderCount = 3 + Math.floor(rnd() * 4);
        const weOffer = rnd() < 0.6;
        const names = shuffled(RIVALS, rnd).slice(0, weOffer ? bidderCount - 1 : bidderCount);
        const bids = names.map((name) => ({ name, own: false, price: reference * (0.92 + rnd() * 0.16), technical: rnd() > 0.07 }));
        // We bid a little higher than the field on average: the pattern the history should reveal.
        if (weOffer) bids.push({ name: OWN, own: true, price: reference * (0.97 + rnd() * 0.1), technical: rnd() > 0.04 });
        const eligible = bids.filter((b) => b.technical);
        const winner = eligible.length ? eligible.reduce((x, y) => (y.price < x.price ? y : x)) : null;
        const outcome = (b: (typeof bids)[number]): BidOutcome => (!b.technical ? "disqualified" : b === winner ? "won" : "lost");
        const decimals = item.price < 1 ? 4 : 3;
        const round = (n: number) => n.toFixed(decimals).replace(/0+$/, "").replace(/\.$/, "");

        const make = (b: (typeof bids)[number], price: "unit" | "total" | "none"): string[] => {
          const cells: Record<string, string> = {
            authority,
            "tender no": tenderNo,
            "tender title": title,
            "award date": date,
            item: item.name,
            "therapeutic area": item.area,
            quantity: String(qty),
            unit: item.unit,
            bidder: b.name,
            "our bid": b.own ? "yes" : "no",
            "unit price": price === "unit" ? round(b.price) : "",
            "line total": price === "total" ? (b.price * qty).toFixed(2) : "",
            result: outcome(b),
            "technical pass": b.technical ? "yes" : "no",
          };
          return HEADER.map((h) => cells[h] ?? "");
        };

        if (cfg.style === "full") for (const b of bids) rows.push(make(b, "unit"));
        else if (cfg.style === "totals_only") for (const b of bids) rows.push(make(b, "total"));
        else if (cfg.style === "winner_only") {
          if (winner) rows.push(make(winner, "unit"));
          const ours = bids.find((b) => b.own);
          if (ours && ours !== winner) rows.push(make(ours, "unit"));
        } else for (const b of bids) rows.push(make(b, b === winner || b.own ? "unit" : "none"));
      }
    }
  }
  return rows;
}

/** The sample as a CSV file, to download and try the import with. */
export function demoTenderResultsCsv(): string {
  return toCsv(HEADER, demoTenderResultRows());
}

/** Turns rows the importer accepted into the shape the price screens read. */
export function bidRowsFromImport(rows: RowRef[]): BidRow[] {
  const archive = new Map<string, string>();
  const lines = new Map<string, string>();
  const id = (map: Map<string, string>, prefix: string, key: string) => {
    if (!map.has(key)) map.set(key, `${prefix}${map.size + 1}`);
    return map.get(key)!;
  };
  return rows.map((r) => {
    const v = r.values;
    const tenderKey = `${v.authority}|${v.tenderNo}`;
    return {
      archiveId: id(archive, "T", tenderKey),
      authority: String(v.authority),
      tenderNo: String(v.tenderNo),
      awardDate: String(v.awardDate),
      lineId: id(lines, "L", `${tenderKey}|${v.lineRef}`),
      itemKey: itemKeyOf(null, String(v.itemName)),
      itemName: String(v.itemName),
      therapeuticArea: v.therapeuticArea == null ? null : String(v.therapeuticArea),
      quantity: v.quantity == null ? null : Number(v.quantity),
      bidder: String(v.bidder),
      isOwn: v.ourBid === true,
      unitPrice: v.unitPrice == null ? null : Number(v.unitPrice),
      currency: String(v.currency ?? "JOD"),
      outcome: String(v.result ?? "unknown") as BidOutcome,
      awardedQuantity: v.awardedQuantity == null ? null : Number(v.awardedQuantity),
    };
  });
}

let cached: BidRow[] | null = null;

/** The sample, read through the real importer. */
export function demoBidRows(): BidRow[] {
  if (cached) return cached;
  const result = validateImport("tender_results", demoTenderResultsCsv(), { today: DEMO_PRICES_AS_OF });
  if (result.fatal || result.rejected.length > 0) throw new Error(`The sample tender results do not pass the importer: ${result.fatal ?? result.rejected[0]!.reason}`);
  cached = bidRowsFromImport(result.accepted);
  return cached;
}
