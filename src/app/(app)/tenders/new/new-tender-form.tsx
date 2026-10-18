"use client";

import { useActionState } from "react";
import { createTenderAction, type TenderFormState } from "@/server/actions/tenders";
import { FieldInput, HiddenField, valuesOf } from "../tender-fields";

const empty = valuesOf(null);

export function NewTenderForm() {
  const [state, action, pending] = useActionState<TenderFormState, FormData>(createTenderAction, {});
  return (
    <form action={action} className="space-y-4 rounded-lg border border-line bg-surface p-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Where is this tender now?</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="startAs" value="pipeline" defaultChecked className="mt-1" />
          <span>
            <b>Pipeline</b>: we expect it, nothing is announced yet
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="startAs" value="open" className="mt-1" />
          <span>
            <b>Announced</b>: the authority published it (tender number, estimated value and deadline are needed)
          </span>
        </label>
      </fieldset>
      <div className="grid gap-4 md:grid-cols-2">
        <FieldInput name="authority" value={empty.authority} />
        <FieldInput name="productLine" value={empty.productLine} />
        <FieldInput name="title" value="" />
        <FieldInput name="tenderNo" value="" />
        <FieldInput name="estimatedValue" value="" />
        <FieldInput name="deadline" value="" />
      </div>
      <FieldInput name="notes" value="" />
      {(["bidValue", "awardAmount", "closeReason", "contractNo", "contractValue", "deliveredOn"] as const).map((k) => (
        <HiddenField key={k} name={k} value="" />
      ))}
      {state.error ? (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="rounded-[7px] bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-[#125747] disabled:opacity-60">
        {pending ? "Saving…" : "Record tender"}
      </button>
    </form>
  );
}
