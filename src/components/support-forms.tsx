"use client";

import { useActionState } from "react";
import { SubmitterField } from "@/components/submitter-field";
import { DIRECTION_LABEL, DIRECTIONS, FUNCTIONS } from "@/core/support-indicators";
import {
  addIndicatorAction,
  deleteIndicatorAction,
  recordReadingAction,
  updateIndicatorAction,
  type SupportFormState,
} from "@/server/actions/support";

const field = "mt-1 block w-full rounded-md border border-line bg-white px-3 py-2 text-sm";
const submit = "rounded-[7px] bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-[#125747] disabled:opacity-60";

export interface IndicatorValues {
  function: string;
  name: string;
  unit: string;
  direction: string;
  target: string;
  responsible: string;
  consequence: string;
}

export const emptyIndicator: IndicatorValues = { function: "", name: "", unit: "%", direction: "at_least", target: "", responsible: "", consequence: "" };

function Status({ state }: { state: SupportFormState }) {
  return (
    <>
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
    </>
  );
}

function IndicatorFields({ values }: { values: IndicatorValues }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className="text-sm font-medium">
        Department
        <select name="function" required defaultValue={values.function} className={field}>
          <option value="" disabled>
            Choose…
          </option>
          {FUNCTIONS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium">
        Indicator
        <input name="name" required maxLength={120} defaultValue={values.name} placeholder="Supplier deliveries on time" className={field} />
      </label>
      <label className="text-sm font-medium">
        Target is
        <select name="direction" defaultValue={values.direction} className={field}>
          {DIRECTIONS.map((d) => (
            <option key={d} value={d}>
              {DIRECTION_LABEL[d]} (the number below)
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <label className="text-sm font-medium">
          Target
          <input name="target" required inputMode="decimal" defaultValue={values.target} placeholder="90" className={field} />
        </label>
        <label className="text-sm font-medium">
          Unit
          <input name="unit" maxLength={20} defaultValue={values.unit} placeholder="% or days" className={field} />
        </label>
      </div>
      <label className="text-sm font-medium">
        Responsible
        <input name="responsible" maxLength={80} defaultValue={values.responsible} placeholder="Procurement manager" className={field} />
      </label>
      <label className="text-sm font-medium">
        Business consequence
        <input name="consequence" maxLength={500} defaultValue={values.consequence} placeholder="What goes wrong when it is missed" className={field} />
      </label>
    </div>
  );
}

export function AddIndicatorForm() {
  const [state, action, pending] = useActionState<SupportFormState, FormData>(addIndicatorAction, {});
  return (
    <form action={action} className="space-y-4 rounded-lg border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold">Add an indicator</h2>
      <IndicatorFields values={emptyIndicator} />
      <SubmitterField />
      <Status state={state} />
      <button type="submit" disabled={pending} className={submit}>
        {pending ? "Adding…" : "Add indicator"}
      </button>
    </form>
  );
}

export function EditIndicatorForm({ id, values }: { id: string; values: IndicatorValues }) {
  const [state, action, pending] = useActionState<SupportFormState, FormData>(updateIndicatorAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <IndicatorFields values={values} />
      <SubmitterField />
      <Status state={state} />
      <button type="submit" disabled={pending} className={submit}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

export function ReadingForm({ id, today, unit }: { id: string; today: string; unit: string }) {
  const [state, action, pending] = useActionState<SupportFormState, FormData>(recordReadingAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-medium">
          Reading{unit ? ` (${unit})` : ""}
          <input name="actual" required inputMode="decimal" className={field} />
        </label>
        <label className="text-sm font-medium">
          Measured on
          <input name="measuredOn" type="date" required max={today} defaultValue={today} className={field} />
        </label>
      </div>
      <SubmitterField />
      <Status state={state} />
      <button type="submit" disabled={pending} className={submit}>
        {pending ? "Saving…" : "Record reading"}
      </button>
    </form>
  );
}

export function RemoveIndicatorForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<SupportFormState, FormData>(deleteIndicatorAction, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <SubmitterField compact />
      <button type="submit" disabled={pending} className="rounded-md border border-bad px-3 py-1.5 text-xs font-semibold text-bad disabled:opacity-60">
        {pending ? "Removing…" : "Remove this indicator"}
      </button>
      {state.error ? (
        <span role="alert" className="text-xs text-bad">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
