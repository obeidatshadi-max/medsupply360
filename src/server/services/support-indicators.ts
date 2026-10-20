import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/import-writer";
import { supportIndicators } from "@/db/schema";
import { isUuid } from "@/core/sales-force";
import { cleanIndicator, cleanReading, type Direction, type IndicatorForm } from "@/core/support-indicators";

export type IndicatorRow = {
  id: string;
  department: string;
  name: string;
  unit: string;
  direction: Direction;
  target: number;
  actual: number | null;
  measuredOn: string | null;
  readingBy: string | null;
  responsible: string | null;
  consequence: string | null;
};

export type IndicatorResult = { ok: true; id: string } | { ok: false; error: string };

const NOT_FOUND = "That indicator was not found.";
const DUPLICATE = "This department already has an indicator with that name.";
const num = (v: string | null): number | null => (v === null ? null : Number(v));

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

/** One company's indicators. Never reads another company's rows. */
export async function listIndicators(db: Db, companyId: string): Promise<IndicatorRow[]> {
  const rows = await db.select().from(supportIndicators).where(eq(supportIndicators.companyId, companyId)).orderBy(asc(supportIndicators.department), asc(sql`lower(${supportIndicators.name})`));
  return rows.map((r) => ({
    id: r.id,
    department: r.department,
    name: r.name,
    unit: r.unit,
    direction: r.direction,
    target: Number(r.target),
    actual: num(r.actual),
    measuredOn: r.measuredOn,
    readingBy: r.readingBy,
    responsible: r.responsible,
    consequence: r.consequence,
  }));
}

const setOf = (form: IndicatorForm) => {
  const c = cleanIndicator(form);
  if (!c.ok) return c;
  const v = c.value;
  return { ok: true as const, set: { department: v.function, name: v.name, unit: v.unit, direction: v.direction, target: String(v.target), responsible: v.responsible, consequence: v.consequence } };
};

export async function addIndicator(db: Db, input: { companyId: string; form: IndicatorForm }): Promise<IndicatorResult> {
  const v = setOf(input.form);
  if (!v.ok) return v;
  try {
    const [row] = await db.insert(supportIndicators).values({ companyId: input.companyId, ...v.set }).returning({ id: supportIndicators.id });
    return { ok: true, id: row!.id };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    return { ok: false, error: DUPLICATE };
  }
}

/** Changes the definition (department, name, target, who answers). The latest reading is kept. */
export async function updateIndicator(db: Db, input: { companyId: string; id: string; form: IndicatorForm }): Promise<IndicatorResult> {
  if (!isUuid(input.id)) return { ok: false, error: NOT_FOUND };
  const v = setOf(input.form);
  if (!v.ok) return v;
  try {
    const changed = await db
      .update(supportIndicators)
      .set({ ...v.set, updatedAt: sql`now()` })
      .where(and(eq(supportIndicators.companyId, input.companyId), eq(supportIndicators.id, input.id)))
      .returning({ id: supportIndicators.id });
    return changed.length ? { ok: true, id: input.id } : { ok: false, error: NOT_FOUND };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    return { ok: false, error: DUPLICATE };
  }
}

/** Records the latest reading. An older measurement date than the one stored is refused, so a late entry cannot overwrite newer data. */
export async function recordReading(db: Db, input: { companyId: string; id: string; actual: string; measuredOn: string; by: string; today: string }): Promise<IndicatorResult> {
  if (!isUuid(input.id)) return { ok: false, error: NOT_FOUND };
  const c = cleanReading({ actual: input.actual, measuredOn: input.measuredOn }, input.today);
  if (!c.ok) return c;
  const [current] = await db
    .select({ measuredOn: supportIndicators.measuredOn })
    .from(supportIndicators)
    .where(and(eq(supportIndicators.companyId, input.companyId), eq(supportIndicators.id, input.id)))
    .limit(1);
  if (!current) return { ok: false, error: NOT_FOUND };
  if (current.measuredOn !== null && c.value.measuredOn < current.measuredOn) {
    return { ok: false, error: `A reading from ${current.measuredOn} is already recorded. Enter a measurement from that day or later.` };
  }
  await db
    .update(supportIndicators)
    .set({ actual: String(c.value.actual), measuredOn: c.value.measuredOn, readingBy: input.by, updatedAt: sql`now()` })
    .where(and(eq(supportIndicators.companyId, input.companyId), eq(supportIndicators.id, input.id)));
  return { ok: true, id: input.id };
}

export async function deleteIndicator(db: Db, input: { companyId: string; id: string }): Promise<IndicatorResult> {
  if (!isUuid(input.id)) return { ok: false, error: NOT_FOUND };
  const gone = await db.delete(supportIndicators).where(and(eq(supportIndicators.companyId, input.companyId), eq(supportIndicators.id, input.id))).returning({ id: supportIndicators.id });
  return gone.length ? { ok: true, id: input.id } : { ok: false, error: NOT_FOUND };
}
