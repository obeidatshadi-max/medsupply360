/**
 * Year-to-date sales and margin by product line. Pure: aggregated rows in, figures out.
 * Cost can be missing on a sales line (NULL in the ERP export). Margin is then worked out only from lines that have a
 * cost, and the share of sales it covers is reported, so a gap shows up instead of inflating the margin.
 */
import { roundJod, type Unavailable } from "./calc";
import { yoyGrowth } from "./accounts";

export type Line = "Equipment" | "Devices" | "Consumables";
export const LINES: Line[] = ["Equipment", "Devices", "Consumables"];
/** Sales loaded as invoice totals: the amount is real, but no product says which line it belongs to. */
export const UNSPLIT = "Not split by product";

/** One line in one period, as summed in the database. Returns are already negative in the sums. */
export interface LineSums {
  /** null = sales with no product (invoice totals). */
  line: Line | null;
  period: "current" | "prior";
  sales: number;
  /** Sales on lines that carry a cost. */
  costedSales: number;
  cost: number;
  linesWithoutCost: number;
}

export interface LineFigures {
  line: Line | "Total" | typeof UNSPLIT;
  sales: number;
  priorSales: number;
  growth: number | Unavailable;
  grossProfit: number | Unavailable;
  margin: number | Unavailable;
  /** Share of sales covered by a known cost, 0..1. Below 1 means the margin leaves some sales out. */
  costCoverage: number | Unavailable;
  linesWithoutCost: number;
}

const empty = (line: Line | null, period: "current" | "prior"): LineSums => ({ line, period, sales: 0, costedSales: 0, cost: 0, linesWithoutCost: 0 });

function figures(line: LineFigures["line"], cur: LineSums, prior: LineSums): LineFigures {
  const known = cur.costedSales !== 0 || cur.cost !== 0;
  const gp = roundJod(cur.costedSales - cur.cost);
  return {
    line,
    sales: roundJod(cur.sales),
    priorSales: roundJod(prior.sales),
    growth: yoyGrowth(cur.sales, prior.sales),
    grossProfit: known ? gp : "Data missing",
    margin: cur.costedSales > 0 ? gp / cur.costedSales : "Data missing",
    costCoverage: cur.sales > 0 ? Math.min(1, cur.costedSales / cur.sales) : "Data missing",
    linesWithoutCost: cur.linesWithoutCost,
  };
}

export function buildSalesByLine(sums: LineSums[]): { lines: LineFigures[]; total: LineFigures } {
  const pick = (line: Line | null, period: "current" | "prior") => sums.find((s) => s.line === line && s.period === period) ?? empty(line, period);
  const lines = LINES.map((l) => figures(l, pick(l, "current"), pick(l, "prior")));
  // Invoice totals carry no product: they get their own row, shown only when there are any, and count in the total.
  const unsplit = figures(UNSPLIT, pick(null, "current"), pick(null, "prior"));
  if (unsplit.sales !== 0 || unsplit.priorSales !== 0) lines.push(unsplit);
  const add = (period: "current" | "prior"): LineSums =>
    [...LINES, null].map((l) => pick(l, period)).reduce(
      (a, s) => ({ ...a, sales: a.sales + s.sales, costedSales: a.costedSales + s.costedSales, cost: a.cost + s.cost, linesWithoutCost: a.linesWithoutCost + s.linesWithoutCost }),
      empty("Equipment", period),
    );
  return { lines, total: figures("Total", add("current"), add("prior")) };
}

/** Same calendar day one year earlier; 29 February maps to 28 February. */
export function sameDayLastYear(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const day = m === 2 && d === 29 ? 28 : d;
  return `${String(y - 1).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
