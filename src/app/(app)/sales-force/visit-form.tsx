"use client";

import { useActionState } from "react";
import { SubmitterField } from "@/components/submitter-field";
import { logVisitAction, type VisitFormState } from "@/server/actions/sales-force";

const field = "mt-1 block w-full rounded-md border border-line bg-white px-3 py-2 text-sm";
const submit = "rounded-[7px] bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-[#125747] disabled:opacity-60";

export type VisitCustomer = { id: string; label: string };

/** Writes down one customer visit. `today` is the business day, so the date starts on the right day for the accountant's time zone. */
export function VisitForm({ personId, today, customers }: { personId: string; today: string; customers: VisitCustomer[] }) {
  const [state, action, pending] = useActionState<VisitFormState, FormData>(logVisitAction, {});
  return (
    <form action={action} className="space-y-4 rounded-lg border border-line bg-surface p-5">
      <input type="hidden" name="personId" value={personId} />
      <div>
        <h2 className="text-sm font-semibold">Log a visit</h2>
        <p className="mt-1 text-xs text-muted">One line for each customer visit this person made. The count of visits in the week comes from these lines.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-medium">
          Date of the visit
          <input name="visitedOn" type="date" required defaultValue={today} max={today} className={field} />
        </label>
        <label className="text-sm font-medium">
          Customer visited
          <select name="customerId" defaultValue="" className={field}>
            <option value="">Not one of the imported customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium md:col-span-2">
          What happened (optional)
          <input name="note" maxLength={300} placeholder="For example: demonstrated the analyzer to the lab manager" className={field} />
        </label>
      </div>
      <SubmitterField />
      {state.error ? (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="text-sm text-brand">
          Visit saved.
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={submit}>
        {pending ? "Saving…" : "Save the visit"}
      </button>
    </form>
  );
}
