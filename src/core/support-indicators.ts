/**
 * Support functions: the few indicators the owner follows for the departments that serve the business (logistics,
 * procurement, HR, customer support, tender support). Pure, so the app and the demo judge a reading the same way.
 *
 * An indicator is a name, a target with a direction ("at least 95%" or "at most 30 days") and the latest reading with the
 * date it was measured. The app does not compute these from the ERP: a person records the reading, and the page says so.
 */
import { isIsoDate } from "./calc";

export const FUNCTIONS = ["Logistics", "Procurement", "HR & development", "Customer support", "Tender support", "Finance", "Other"] as const;
export const DIRECTIONS = ["at_least", "at_most"] as const;
export type Direction = (typeof DIRECTIONS)[number];
export const DIRECTION_LABEL: Record<Direction, string> = { at_least: "At least", at_most: "At most" };

export const NAME_MAX = 120;
export const UNIT_MAX = 20;
export const PERSON_MAX = 80;
export const NOTE_MAX = 500;
export const VALUE_MAX = 1_000_000_000;

export interface IndicatorForm {
  function: string;
  name: string;
  unit: string;
  direction: string;
  target: string;
  responsible: string;
  consequence: string;
}

export interface IndicatorValues {
  function: string;
  name: string;
  unit: string;
  direction: Direction;
  target: number;
  responsible: string | null;
  consequence: string | null;
}

export type Cleaned<T> = { ok: true; value: T } | { ok: false; error: string };

const tidy = (v: unknown) =>
  String(v ?? "")
    .replace(/[\u0000-\u001f\u007f‎‏‪-‮]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** A plain non-negative number with up to three decimals; Arabic-Indic digits and thousands commas are accepted. */
export function parseAmount(raw: unknown): number | null {
  const t = String(raw ?? "")
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/٫/g, ".")
    .replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{1,3})?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n <= VALUE_MAX ? n : null;
}

export function cleanIndicator(form: IndicatorForm): Cleaned<IndicatorValues> {
  const fn = tidy(form.function);
  if (!(FUNCTIONS as readonly string[]).includes(fn)) return { ok: false, error: "Choose which department this indicator belongs to." };
  const name = tidy(form.name);
  if (name.length < 3 || !/\p{L}/u.test(name)) return { ok: false, error: "Name the indicator, for example “Supplier deliveries on time”." };
  if (name.length > NAME_MAX) return { ok: false, error: `Use ${NAME_MAX} characters or fewer for the name.` };
  const unit = tidy(form.unit);
  if (unit.length > UNIT_MAX) return { ok: false, error: `Use ${UNIT_MAX} characters or fewer for the unit.` };
  if (!(DIRECTIONS as readonly string[]).includes(form.direction)) return { ok: false, error: "Say whether the target is a minimum (at least) or a maximum (at most)." };
  const target = parseAmount(form.target);
  if (target === null) return { ok: false, error: "The target must be a number, for example 95 or 30." };
  const responsible = tidy(form.responsible);
  if (responsible.length > PERSON_MAX) return { ok: false, error: `Use ${PERSON_MAX} characters or fewer for the responsible person.` };
  const consequence = tidy(form.consequence);
  if (consequence.length > NOTE_MAX) return { ok: false, error: `Use ${NOTE_MAX} characters or fewer for the business consequence.` };
  return { ok: true, value: { function: fn, name, unit, direction: form.direction as Direction, target, responsible: responsible || null, consequence: consequence || null } };
}

/** A new reading: the figure and the day it was measured (never in the future). */
export function cleanReading(form: { actual: string; measuredOn: string }, today: string): Cleaned<{ actual: number; measuredOn: string }> {
  const actual = parseAmount(form.actual);
  if (actual === null) return { ok: false, error: "The reading must be a number, for example 88." };
  const measuredOn = form.measuredOn.trim();
  if (!isIsoDate(measuredOn)) return { ok: false, error: "Enter the day the reading was measured." };
  if (measuredOn > today) return { ok: false, error: "The measurement date cannot be in the future." };
  return { ok: true, value: { actual, measuredOn } };
}

export type IndicatorStatus = "met" | "missed" | "no_reading";
export const STATUS_LABEL: Record<IndicatorStatus, string> = { met: "On target", missed: "Off target", no_reading: "No reading yet" };

export function indicatorStatus(direction: Direction, target: number, actual: number | null): IndicatorStatus {
  if (actual === null) return "no_reading";
  return (direction === "at_least" ? actual >= target : actual <= target) ? "met" : "missed";
}

/** How far off target a reading is, in the indicator's unit; zero when it meets the target. */
export function distanceFromTarget(direction: Direction, target: number, actual: number | null): number {
  if (actual === null) return 0;
  return Math.max(0, direction === "at_least" ? target - actual : actual - target);
}

const trimZeros = (n: number) => String(Number(n.toFixed(3)));

/** "88%", "42 days", "4800" (no unit). */
export function valueText(v: number, unit: string): string {
  const u = unit.trim();
  return u === "" ? trimZeros(v) : u === "%" ? `${trimZeros(v)}%` : `${trimZeros(v)} ${u}`;
}

/** "≥ 95%" or "≤ 30 days". */
export const targetText = (direction: Direction, target: number, unit: string): string => `${direction === "at_least" ? "≥" : "≤"} ${valueText(target, unit)}`;

export interface IndicatorRow {
  department: string;
  name: string;
  direction: Direction;
  target: number;
  actual: number | null;
}

/** Off-target first (the biggest miss at the top), then indicators with no reading, then those on target; then by department and name. */
export function sortIndicators<T extends IndicatorRow>(list: readonly T[]): T[] {
  const rank = (s: IndicatorStatus) => (s === "missed" ? 0 : s === "no_reading" ? 1 : 2);
  const relative = (i: T) => (i.target === 0 ? distanceFromTarget(i.direction, i.target, i.actual) : distanceFromTarget(i.direction, i.target, i.actual) / i.target);
  return [...list].sort((a, b) => {
    const sa = indicatorStatus(a.direction, a.target, a.actual);
    const sb = indicatorStatus(b.direction, b.target, b.actual);
    return rank(sa) - rank(sb) || relative(b) - relative(a) || FUNCTIONS.indexOf(a.department as (typeof FUNCTIONS)[number]) - FUNCTIONS.indexOf(b.department as (typeof FUNCTIONS)[number]) || a.name.localeCompare(b.name);
  });
}

/** Counts for the top tiles. */
export function summarize(list: readonly IndicatorRow[]) {
  const status = list.map((i) => indicatorStatus(i.direction, i.target, i.actual));
  return {
    total: list.length,
    missed: status.filter((s) => s === "missed").length,
    met: status.filter((s) => s === "met").length,
    noReading: status.filter((s) => s === "no_reading").length,
    departments: new Set(list.map((i) => i.department)).size,
  };
}
