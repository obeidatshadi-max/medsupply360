"use client";

import { useActionState } from "react";
import { addDeliveryAction, deleteDeliveryAction, type DeliveryFormState } from "@/server/actions/tender-deliveries";
import { SubmitterField } from "@/components/submitter-field";
import { deliveryProgress } from "@/core/tender-deliveries";
import type { DeliveryRow } from "@/server/services/tender-deliveries";
import { dayText, jod } from "@/lib/format";
import { fieldClass } from "../tender-fields";

/** Part deliveries of a contracted tender: what has gone out, how much of the contract that is, and a form to add the next one. */
export function Deliveries({ tenderId, rows, contractValue, canEdit, canAdd }: { tenderId: string; rows: DeliveryRow[]; contractValue: number | null; canEdit: boolean; canAdd: boolean }) {
  const [state, action, pending] = useActionState<DeliveryFormState, FormData>(addDeliveryAction, {});
  const p = deliveryProgress(contractValue, rows);
  return (
    <section aria-label="Deliveries" className="space-y-3">
      <h2 className="text-sm font-semibold">Deliveries</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No delivery recorded yet. A tender may be delivered in parts: record each one here, then move the tender to Delivered when everything has gone out.</p>
      ) : (
        <p className="text-sm">
          {p.count} deliver{p.count === 1 ? "y" : "ies"} · delivered <b className="tabular-nums">{jod(p.deliveredValue)}</b>
          {p.percent !== null ? ` (${p.percent}% of the contract)` : ""}
          {p.outstanding !== null ? (
            <>
              {" "}
              · still to deliver <b className="tabular-nums">{jod(p.outstanding)}</b>
            </>
          ) : null}
          {p.overDelivered > 0 ? <span className="text-warn"> · {jod(p.overDelivered)} above the contract value (a variation order?)</span> : null}
          {p.withoutValue > 0 ? <span className="text-xs text-muted"> · {p.withoutValue} without a value, so the total is a minimum</span> : null}
        </p>
      )}
      <ul className="space-y-2">
        {rows.map((d) => (
          <li key={d.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-line bg-white px-4 py-3 text-sm">
            <span>
              <b>{dayText(d.deliveredOn)}</b>
              {d.note ? <span className="text-muted"> · {d.note}</span> : null}
            </span>
            <span className="flex items-baseline gap-3">
              <span className="tabular-nums">{d.value === null ? "value not entered" : jod(d.value)}</span>
              {canEdit ? (
                <form action={deleteDeliveryAction} className="flex items-center gap-2">
                  <input type="hidden" name="tenderId" value={tenderId} />
                  <input type="hidden" name="deliveryId" value={d.id} />
                  <SubmitterField compact />
                  <button type="submit" className="text-xs text-bad underline underline-offset-2">
                    Remove
                  </button>
                </form>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {canEdit && canAdd ? (
        <form action={action} className="space-y-3 rounded-lg border border-line bg-surface p-5">
          <input type="hidden" name="tenderId" value={tenderId} />
          <p className="text-sm font-medium">Add a delivery</p>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium">Delivery date</label>
              <input name="deliveredOn" type="date" required className={fieldClass} />
            </div>
            <div>
              <label className="text-sm font-medium">Value delivered (JOD, at contract prices)</label>
              <input name="value" inputMode="decimal" autoComplete="off" className={fieldClass} />
            </div>
            <div>
              <label className="text-sm font-medium">Note (optional)</label>
              <input name="note" maxLength={500} autoComplete="off" className={fieldClass} />
            </div>
          </div>
          <SubmitterField />
          {state.error ? (
            <p role="alert" className="text-sm text-bad">
              {state.error}
            </p>
          ) : null}
          {state.saved ? (
            <p role="status" className="text-sm text-brand">
              Saved.
            </p>
          ) : null}
          <button type="submit" disabled={pending} className="rounded-[7px] border border-line bg-white px-4 py-2 text-sm font-semibold hover:border-brand disabled:opacity-60">
            {pending ? "Saving…" : "Add delivery"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
