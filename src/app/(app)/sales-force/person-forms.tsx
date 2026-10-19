"use client";

import { useActionState } from "react";
import { addSalesPersonAction, updateSalesPersonAction, type SalesFormState } from "@/server/actions/sales-force";
import { PersonFields, emptyPerson, type PersonValues } from "./person-fields";

const submit = "rounded-[7px] bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-[#125747] disabled:opacity-60";

export function AddPersonForm({ supplierOptions }: { supplierOptions: string[] }) {
  const [state, action, pending] = useActionState<SalesFormState, FormData>(addSalesPersonAction, {});
  return (
    <form action={action} className="space-y-4 rounded-lg border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold">Add a sales person</h2>
      <PersonFields values={emptyPerson} supplierOptions={supplierOptions} />
      {state.error ? (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={submit}>
        {pending ? "Adding…" : "Add to the sales force"}
      </button>
    </form>
  );
}

export function EditPersonForm({ id, values, supplierOptions }: { id: string; values: PersonValues; supplierOptions: string[] }) {
  const [state, action, pending] = useActionState<SalesFormState, FormData>(updateSalesPersonAction, {});
  return (
    <form action={action} className="space-y-4 rounded-lg border border-line bg-surface p-5">
      <input type="hidden" name="id" value={id} />
      <h2 className="text-sm font-semibold">Profile and expectations</h2>
      <PersonFields values={values} supplierOptions={supplierOptions} />
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
      <button type="submit" disabled={pending} className={submit}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
