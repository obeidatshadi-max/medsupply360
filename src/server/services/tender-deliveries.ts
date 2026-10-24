import { and, asc, eq } from "drizzle-orm";
import { isIsoDate } from "@/core/calc";
import { parseJod } from "@/core/jod";
import { NOTE_MAX, type DeliveryForm } from "@/core/tender-deliveries";
import type { TenderStatus } from "@/core/tender-flow";
import type { Db } from "@/db/import-writer";
import { tenderDeliveries, tenders } from "@/db/schema";
import { businessToday } from "@/lib/business-date";

export type DeliveryRow = { id: string; deliveredOn: string; value: number | null; note: string | null };
export type DeliveryResult = { ok: true; id: string } | { ok: false; error: string };

/** Deliveries are recorded once there is a contract; a late correction after Delivered is still allowed. */
const DELIVERY_STATUSES: readonly TenderStatus[] = ["contracted", "delivered"];

export async function listDeliveries(db: Db, companyId: string, tenderId: string): Promise<DeliveryRow[]> {
  const rows = await db
    .select()
    .from(tenderDeliveries)
    .where(and(eq(tenderDeliveries.companyId, companyId), eq(tenderDeliveries.tenderId, tenderId)))
    .orderBy(asc(tenderDeliveries.deliveredOn), asc(tenderDeliveries.createdAt));
  return rows.map((r) => ({ id: r.id, deliveredOn: r.deliveredOn, value: r.value === null ? null : Number(r.value), note: r.note }));
}

export async function addDelivery(db: Db, input: { companyId: string; userId: string; tenderId: string; form: DeliveryForm }): Promise<DeliveryResult> {
  const [tender] = await db.select({ status: tenders.status }).from(tenders).where(and(eq(tenders.companyId, input.companyId), eq(tenders.id, input.tenderId))).limit(1);
  if (!tender) return { ok: false, error: "That tender was not found." };
  if (!DELIVERY_STATUSES.includes(tender.status)) return { ok: false, error: "Deliveries can be recorded once the tender is contracted." };
  const on = input.form.deliveredOn.trim();
  if (!isIsoDate(on)) return { ok: false, error: "Enter the delivery date." };
  if (on > businessToday()) return { ok: false, error: "The delivery date cannot be in the future." };
  const value = parseJod(input.form.value);
  if (value === "invalid") return { ok: false, error: "The value must be a number in JOD, for example 12500 or 12,500.250." };
  if (value !== null && value <= 0) return { ok: false, error: "The value delivered must be above zero, or left empty." };
  const note = input.form.note.trim();
  if (note.length > NOTE_MAX) return { ok: false, error: `The note is longer than ${NOTE_MAX} characters.` };
  const [row] = await db
    .insert(tenderDeliveries)
    .values({ companyId: input.companyId, tenderId: input.tenderId, deliveredOn: on, value: value === null ? null : value.toFixed(3), note: note === "" ? null : note, createdBy: input.userId })
    .returning({ id: tenderDeliveries.id });
  return { ok: true, id: row!.id };
}

export async function deleteDelivery(db: Db, input: { companyId: string; tenderId: string; deliveryId: string }): Promise<DeliveryResult> {
  const gone = await db
    .delete(tenderDeliveries)
    .where(and(eq(tenderDeliveries.companyId, input.companyId), eq(tenderDeliveries.tenderId, input.tenderId), eq(tenderDeliveries.id, input.deliveryId)))
    .returning({ id: tenderDeliveries.id });
  return gone.length ? { ok: true, id: input.deliveryId } : { ok: false, error: "That delivery was not found." };
}
