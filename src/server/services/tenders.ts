import { and, asc, desc, eq, sql } from "drizzle-orm";
import { isIsoDate } from "@/core/calc";
import {
  PRODUCT_LINES,
  STATUS_LABEL,
  isAuthority,
  backMove,
  isLegalMove,
  missingFor,
  neededFor,
  type AuthorityCode,
  type TenderFields,
  type TenderLine,
  type TenderStatus,
} from "@/core/tender-flow";
import { canEditTender, canMoveTender, type Role } from "@/core/permissions";
import type { Db } from "@/db/import-writer";
import { tenderStatusLog, tenders, users } from "@/db/schema";

export type TenderRow = TenderFields & {
  id: string;
  authority: AuthorityCode;
  title: string;
  productLine: TenderLine;
  status: TenderStatus;
  statusChangedAt: Date;
  notes: string | null;
  createdAt: Date;
};

export type TenderEvent = { id: string; fromStatus: TenderStatus | null; toStatus: TenderStatus; note: string | null; at: Date; by: string | null };

export type TenderResult = { ok: true; id: string } | { ok: false; error: string };

const num = (v: string | null): number | null => (v === null ? null : Number(v));

type Raw = typeof tenders.$inferSelect;
const toRow = (r: Raw): TenderRow => ({
  id: r.id,
  authority: r.authority,
  tenderNo: r.tenderNo,
  title: r.title,
  productLine: r.productLine,
  status: r.status,
  statusChangedAt: r.statusChangedAt,
  estimatedValue: num(r.estimatedValue),
  deadline: r.deadline,
  bidValue: num(r.bidValue),
  awardAmount: num(r.awardAmount),
  closeReason: r.closeReason,
  contractNo: r.contractNo,
  contractValue: num(r.contractValue),
  deliveredOn: r.deliveredOn,
  notes: r.notes,
  createdAt: r.createdAt,
});

/** A form value as a JOD amount: blank is "not known yet", commas are thousands separators, anything else is an error. */
export function parseJod(input: string | null | undefined): number | null | "invalid" {
  const text = (input ?? "").trim().replace(/,/g, "");
  if (text === "") return null;
  if (!/^\d+(\.\d{1,3})?$/.test(text)) return "invalid";
  return Number(text);
}

const text = (v: string | null | undefined, max: number): string | null => {
  const t = (v ?? "").trim();
  return t === "" ? null : t.slice(0, max);
};

const amountText = (v: number | null) => (v === null ? "" : String(v));

/** A stored tender as the form strings the screens post, so stored values can stand in for submitted ones. */
export function formOf(t: TenderRow): TenderForm {
  return {
    authority: t.authority,
    tenderNo: t.tenderNo ?? "",
    title: t.title,
    productLine: t.productLine,
    estimatedValue: amountText(t.estimatedValue),
    deadline: t.deadline ?? "",
    bidValue: amountText(t.bidValue),
    awardAmount: amountText(t.awardAmount),
    closeReason: t.closeReason ?? "",
    contractNo: t.contractNo ?? "",
    contractValue: amountText(t.contractValue),
    deliveredOn: t.deliveredOn ?? "",
    notes: t.notes ?? "",
  };
}

/**
 * What a move may save. The tender department and the owner may change any detail (they can already edit them). Any other
 * role (finance) saves only the details the target status asks for; every other field is kept as stored, whatever was posted.
 * A step back asks for nothing, so for those roles it saves nothing.
 */
export function formForMove(role: Role, stored: TenderRow, posted: TenderForm, to: TenderStatus): TenderForm {
  if (canEditTender(role)) return posted;
  const merged: TenderForm = formOf(stored);
  if (backMove(stored.status) === to) return merged;
  for (const { key } of neededFor(to)) (merged as Record<string, string>)[key] = (posted as Record<string, string>)[key];
  return merged;
}

/** Everything the tender screens may edit, as raw form strings. */
export type TenderForm = {
  authority: string;
  tenderNo: string;
  title: string;
  productLine: string;
  estimatedValue: string;
  deadline: string;
  bidValue: string;
  awardAmount: string;
  closeReason: string;
  contractNo: string;
  contractValue: string;
  deliveredOn: string;
  notes: string;
};

type Clean = Omit<TenderFields, never> & { authority: AuthorityCode; title: string; productLine: TenderLine; notes: string | null };

function clean(form: TenderForm): { ok: true; value: Clean } | { ok: false; error: string } {
  if (!isAuthority(form.authority)) return { ok: false, error: "Choose the tender authority." };
  const title = text(form.title, 300);
  if (!title) return { ok: false, error: "Enter a short title for the tender." };
  if (!(PRODUCT_LINES as readonly string[]).includes(form.productLine)) return { ok: false, error: "Choose equipment, consumables or both." };
  const money = {} as Record<"estimatedValue" | "bidValue" | "awardAmount" | "contractValue", number | null>;
  for (const [key, label] of [
    ["estimatedValue", "estimated value"],
    ["bidValue", "bid value"],
    ["awardAmount", "award amount"],
    ["contractValue", "contract value"],
  ] as const) {
    const v = parseJod(form[key]);
    if (v === "invalid") return { ok: false, error: `The ${label} must be a number in JOD, for example 12500 or 12,500.250.` };
    money[key] = v;
  }
  const dates = {} as Record<"deadline" | "deliveredOn", string | null>;
  for (const [key, label] of [
    ["deadline", "submission deadline"],
    ["deliveredOn", "delivery date"],
  ] as const) {
    const v = form[key].trim();
    if (v !== "" && !isIsoDate(v)) return { ok: false, error: `The ${label} is not a valid date.` };
    dates[key] = v === "" ? null : v;
  }
  return {
    ok: true,
    value: {
      authority: form.authority,
      title,
      productLine: form.productLine as TenderLine,
      tenderNo: text(form.tenderNo, 80),
      estimatedValue: money.estimatedValue,
      deadline: dates.deadline,
      bidValue: money.bidValue,
      awardAmount: money.awardAmount,
      closeReason: text(form.closeReason, 2000),
      contractNo: text(form.contractNo, 80),
      contractValue: money.contractValue,
      deliveredOn: dates.deliveredOn,
      notes: text(form.notes, 4000),
    },
  };
}

const money3 = (v: number | null) => (v === null ? null : v.toFixed(3));

const duplicateMessage = "A tender with this number already exists for this authority.";

/** Postgres unique violation (23505), whether the driver error is raw or wrapped by Drizzle. Anything else is a real failure. */
function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

export async function listTenders(db: Db, companyId: string): Promise<TenderRow[]> {
  const rows = await db.select().from(tenders).where(eq(tenders.companyId, companyId)).orderBy(desc(tenders.updatedAt));
  return rows.map(toRow);
}

export async function getTender(db: Db, companyId: string, id: string): Promise<{ tender: TenderRow; history: TenderEvent[] } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(tenders).where(and(eq(tenders.companyId, companyId), eq(tenders.id, id))).limit(1);
  if (!row) return null;
  const log = await db
    .select({ id: tenderStatusLog.id, fromStatus: tenderStatusLog.fromStatus, toStatus: tenderStatusLog.toStatus, note: tenderStatusLog.note, at: tenderStatusLog.createdAt, by: users.fullName })
    .from(tenderStatusLog)
    .leftJoin(users, eq(users.id, tenderStatusLog.userId))
    .where(and(eq(tenderStatusLog.companyId, companyId), eq(tenderStatusLog.tenderId, id)))
    .orderBy(asc(tenderStatusLog.createdAt));
  return { tender: toRow(row), history: log };
}

/** A new tender starts as a pipeline opportunity, or as an announced tender when its number, value and deadline are known. */
export async function createTender(db: Db, input: { companyId: string; userId: string; form: TenderForm; startAs: "pipeline" | "open" }): Promise<TenderResult> {
  const c = clean(input.form);
  if (!c.ok) return c;
  const v = c.value;
  const missing = missingFor(input.startAs, v);
  if (missing.length) return { ok: false, error: `To record an announced tender, also enter: ${missing.join(", ")}.` };
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(tenders)
        .values({
          companyId: input.companyId,
          authority: v.authority,
          tenderNo: v.tenderNo,
          title: v.title,
          productLine: v.productLine,
          status: input.startAs,
          estimatedValue: money3(v.estimatedValue),
          deadline: v.deadline,
          bidValue: money3(v.bidValue),
          awardAmount: money3(v.awardAmount),
          closeReason: v.closeReason,
          contractNo: v.contractNo,
          contractValue: money3(v.contractValue),
          deliveredOn: v.deliveredOn,
          notes: v.notes,
          createdBy: input.userId,
        })
        .returning({ id: tenders.id });
      await tx.insert(tenderStatusLog).values({ companyId: input.companyId, tenderId: row!.id, fromStatus: null, toStatus: input.startAs, userId: input.userId, note: "Tender recorded" });
      return { ok: true as const, id: row!.id };
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    return { ok: false, error: duplicateMessage };
  }
}

/** Correct or complete a tender's details. The status is changed only through `moveTender`. */
export async function updateTender(db: Db, input: { companyId: string; tenderId: string; form: TenderForm }): Promise<TenderResult> {
  const c = clean(input.form);
  if (!c.ok) return c;
  const v = c.value;
  const [current] = await db.select({ status: tenders.status }).from(tenders).where(and(eq(tenders.companyId, input.companyId), eq(tenders.id, input.tenderId))).limit(1);
  if (!current) return { ok: false, error: "That tender was not found." };
  try {
    await db
      .update(tenders)
      .set({
        authority: v.authority,
        tenderNo: v.tenderNo,
        title: v.title,
        productLine: v.productLine,
        estimatedValue: money3(v.estimatedValue),
        deadline: v.deadline,
        bidValue: money3(v.bidValue),
        awardAmount: money3(v.awardAmount),
        closeReason: v.closeReason,
        contractNo: v.contractNo,
        contractValue: money3(v.contractValue),
        deliveredOn: v.deliveredOn,
        notes: v.notes,
        updatedAt: sql`now()`,
      })
      .where(and(eq(tenders.companyId, input.companyId), eq(tenders.id, input.tenderId)));
    return { ok: true, id: input.tenderId };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    return { ok: false, error: duplicateMessage };
  }
}

/**
 * Move a tender to its next (or previous) status. The details typed on the move form are saved together with the move, so
 * "Submitted" can ask for the bid value in the same step. The move is refused if the tender changed since the page opened.
 */
export async function moveTender(
  db: Db,
  input: { companyId: string; userId: string; role: Role; tenderId: string; to: TenderStatus; seenStatus: TenderStatus; form: TenderForm; note: string },
): Promise<TenderResult> {
  const found = await getTender(db, input.companyId, input.tenderId);
  if (!found) return { ok: false, error: "That tender was not found." };
  const from = found.tender.status;
  if (from !== input.seenStatus) return { ok: false, error: `Someone already moved this tender to ${STATUS_LABEL[from]}. Reload the page.` };
  if (!isLegalMove(from, input.to)) return { ok: false, error: `A tender cannot go from ${STATUS_LABEL[from]} to ${STATUS_LABEL[input.to]}.` };
  if (!canMoveTender(input.role, from, input.to)) return { ok: false, error: "Your role cannot make this change." };

  const c = clean(formForMove(input.role, found.tender, input.form, input.to));
  if (!c.ok) return c;
  const v = c.value;
  const missing = missingFor(input.to, v, from);
  if (missing.length) return { ok: false, error: `Before moving to ${STATUS_LABEL[input.to]}, enter: ${missing.join(", ")}.` };

  try {
    return await db.transaction(async (tx) => {
      const changed = await tx
        .update(tenders)
        .set({
          authority: v.authority,
          tenderNo: v.tenderNo,
          title: v.title,
          productLine: v.productLine,
          status: input.to,
          statusChangedAt: sql`now()`,
          estimatedValue: money3(v.estimatedValue),
          deadline: v.deadline,
          bidValue: money3(v.bidValue),
          awardAmount: money3(v.awardAmount),
          closeReason: v.closeReason,
          contractNo: v.contractNo,
          contractValue: money3(v.contractValue),
          deliveredOn: v.deliveredOn,
          notes: v.notes,
          updatedAt: sql`now()`,
        })
        .where(and(eq(tenders.companyId, input.companyId), eq(tenders.id, input.tenderId), eq(tenders.status, from)))
        .returning({ id: tenders.id });
      if (changed.length === 0) return { ok: false as const, error: "The tender changed while you were editing. Reload the page." };
      await tx.insert(tenderStatusLog).values({ companyId: input.companyId, tenderId: input.tenderId, fromStatus: from, toStatus: input.to, userId: input.userId, note: text(input.note, 2000) });
      return { ok: true as const, id: input.tenderId };
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    return { ok: false, error: duplicateMessage };
  }
}
