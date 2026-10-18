"use client";

import { useActionState } from "react";
import { updateTenderAction, type TenderFormState } from "@/server/actions/tenders";
import { FieldInput, type FieldValues } from "../tender-fields";

const ORDER = ["authority", "productLine", "title", "tenderNo", "estimatedValue", "deadline", "bidValue", "awardAmount", "contractNo", "contractValue", "deliveredOn"] as const;

/** Corrects or completes a tender's details. The status is changed only in the move panel, which keeps the history honest. */
export function DetailsForm({ tenderId, values }: { tenderId: string; values: FieldValues }) {
  const [state, action, pending] = useActionState<TenderFormState, FormData>(updateTenderAction, {});
  return (
    <form action={action} className="space-y-4 rounded-lg border border-line bg-surface p-5">
      <input type="hidden" name="tenderId" value={tenderId} />
      <h2 className="text-sm font-semibold">Details</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {ORDER.map((k) => (
          <FieldInput key={k} name={k} value={values[k]} />
        ))}
      </div>
      <FieldInput name="closeReason" value={values.closeReason} />
      <FieldInput name="notes" value={values.notes} />
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
        {pending ? "Saving…" : "Save details"}
      </button>
    </form>
  );
}
