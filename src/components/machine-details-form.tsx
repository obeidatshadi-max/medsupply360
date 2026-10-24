"use client";

import { useActionState } from "react";
import { SubmitterField } from "@/components/submitter-field";
import { SERVICE_OPTIONS } from "@/core/machine-details";
import { saveMachineDetailsAction, type MachineFormState } from "@/server/actions/machine-details";

const field = "mt-1 block w-full rounded-md border border-line bg-white px-3 py-2 text-sm";

export type MachineOption = { code: string; label: string };

/** Add what the sales file cannot say about a machine: pick the machine from the list, then fill in only what you know. */
export function MachineDetailsForm({ machines }: { machines: MachineOption[] }) {
  const [state, action, pending] = useActionState<MachineFormState, FormData>(saveMachineDetailsAction, {});
  return (
    <form action={action} className="space-y-4 rounded-lg border border-line bg-surface p-5">
      <div>
        <h2 className="text-sm font-semibold">Machine details</h2>
        <p className="mt-1 text-xs text-muted">
          Machines come from the sales you imported, so there is nothing to retype. Choose one and add what only you know: when its warranty ends, whether it is under a service contract, and how much in consumables it should use each month. Leave empty what you do not know; an empty field keeps what is already recorded.
        </p>
      </div>
      {machines.length === 0 ? (
        <p className="text-sm text-muted">No machine yet. Import the sales file under ERP system: every equipment or device sold becomes a machine you can choose here.</p>
      ) : (
        <>
          <label className="block text-sm font-medium">
            Machine
            <select name="code" required defaultValue="" className={field}>
              <option value="" disabled>
                Choose a machine…
              </option>
              {machines.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 md:grid-cols-2">
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
              Installed on (if different from the first sale)
              <input name="installedOn" type="date" className={field} />
            </label>
            <label className="text-sm font-medium">
              Consumables it should use a month (JOD)
              <input name="expectedMonthly" inputMode="decimal" placeholder="Optional" className={field} />
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
              Saved.
            </p>
          ) : null}
          <button type="submit" disabled={pending} className="rounded-[7px] bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-[#125747] disabled:opacity-60">
            {pending ? "Saving…" : "Save the details"}
          </button>
        </>
      )}
    </form>
  );
}
