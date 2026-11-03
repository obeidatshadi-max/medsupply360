"use client";

import { useActionState, useId } from "react";
import { SubmitterField } from "@/components/submitter-field";
import { SERVICE_OPTIONS } from "@/core/machine-details";
import { addMachineAction, type MachineFormState } from "@/server/actions/machine-details";

const field = "mt-1 block w-full rounded-md border border-line bg-white px-3 py-2 text-sm";

export type CustomerOption = { code: string; name: string };

/** Add a machine that the sales do not show (bought elsewhere, a loan unit). The customer is chosen from the customer list. */
export function NewMachineForm({ customers }: { customers: CustomerOption[] }) {
  const [state, action, pending] = useActionState<MachineFormState, FormData>(addMachineAction, {});
  const listId = useId();
  return (
    <form action={action} className="space-y-4 rounded-lg border border-line bg-surface p-5">
      <div>
        <h2 className="text-sm font-semibold">Add a new machine</h2>
        <p className="mt-1 text-xs text-muted">
          For a machine that is not in the sales files, such as one bought elsewhere or a loan unit. Give it a code (its serial number is a good one), a name and its customer. All the other fields are optional and can be added later. To change a machine that is already listed, use Machine details above.
        </p>
      </div>
      {customers.length === 0 ? (
        <p className="text-sm text-muted">No customer yet. Import the customer list under ERP system first: a machine belongs to a customer on that list.</p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium">
              Machine code
              <input name="code" required maxLength={80} placeholder="e.g. serial number" className={field} />
            </label>
            <label className="text-sm font-medium">
              Machine name
              <input name="name" required maxLength={300} placeholder="e.g. Portable X-ray unit" className={field} />
            </label>
            <label className="text-sm font-medium md:col-span-2">
              Customer (type the code or the name, then choose)
              <input name="customerCode" required list={listId} autoComplete="off" placeholder="Customer code" className={field} />
              <datalist id={listId}>
                {customers.map((c) => (
                  <option key={c.code} value={c.code} label={c.name} />
                ))}
              </datalist>
            </label>
            <label className="text-sm font-medium">
              Installed on
              <input name="installedOn" type="date" className={field} />
            </label>
            <label className="text-sm font-medium">
              Warranty ends
              <input name="warrantyEnd" type="date" className={field} />
            </label>
            <label className="text-sm font-medium">
              Service contract
              <select name="service" defaultValue="" className={field}>
                <option value="">Not known</option>
                {SERVICE_OPTIONS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Consumables it should use a month (JOD)
              <input name="expectedMonthly" inputMode="decimal" placeholder="Optional" className={field} />
            </label>
            <label className="text-sm font-medium">
              Service contract starts
              <input name="contractStart" type="date" className={field} />
            </label>
            <label className="text-sm font-medium">
              Service contract ends
              <input name="contractEnd" type="date" className={field} />
            </label>
            <label className="text-sm font-medium">
              Contact at the customer
              <input name="contactName" maxLength={200} placeholder="Name" className={field} />
            </label>
            <label className="text-sm font-medium">
              Contact phone
              <input name="contactPhone" maxLength={60} inputMode="tel" placeholder="Optional" className={field} />
            </label>
            <label className="text-sm font-medium md:col-span-2">
              Contact email
              <input name="contactEmail" type="email" maxLength={255} placeholder="Optional" className={field} />
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
              Machine added.
            </p>
          ) : null}
          <button type="submit" disabled={pending} className="rounded-[7px] bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-[#125747] disabled:opacity-60">
            {pending ? "Adding…" : "Add the machine"}
          </button>
        </>
      )}
    </form>
  );
}
