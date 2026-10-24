/**
 * The business-line filter: All lines, or one of Equipment, Devices and Consumables. Pure.
 * The choice is kept in a cookie so it follows the person from screen to screen, as it does in the demo. A figure that
 * cannot be split by line (money owed by customers, tenders, people, settings) ignores the filter, and the page says so.
 */
import { LINES, type Line, type LineFigures } from "./sales-by-line";

export const ALL_LINES = "All lines";
export const LINE_OPTIONS = [ALL_LINES, ...LINES] as const;
export type LineChoice = (typeof LINE_OPTIONS)[number];
export const LINE_COOKIE = "sadaf_line";

/** The line a stored or posted value stands for; null means every line. Anything unknown is treated as every line. */
export function parseLine(value: unknown): Line | null {
  return typeof value === "string" && (LINES as readonly string[]).includes(value) ? (value as Line) : null;
}

export const choiceOf = (line: Line | null): LineChoice => line ?? ALL_LINES;

/** The sales-by-line result narrowed to one line: that line becomes the headline figure and the only row. */
export function salesForLine<T extends { lines: LineFigures[]; total: LineFigures }>(sales: T, line: Line | null): T {
  if (line === null) return sales;
  const one = sales.lines.find((l) => l.line === line);
  return one ? { ...sales, lines: [one], total: { ...one, line: "Total" } } : sales;
}

/** The unit's machine line must be the chosen line; a unit with no product (so no line) only appears under All lines. */
export const unitInLine = (unitLine: Line | null, line: Line | null): boolean => line === null || unitLine === line;
