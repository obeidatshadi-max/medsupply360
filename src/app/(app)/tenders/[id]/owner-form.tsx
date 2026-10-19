"use client";

import { useActionState } from "react";
import { assignTenderOwnerAction, type AssignState } from "@/server/actions/sales-force";
import { fieldClass } from "../tender-fields";

type Choice = { id: string; name: string; active: boolean };

/** The CEO picks who is responsible for this tender. A person turned off stays selectable only while they already hold it. */
export function OwnerForm({ tenderId, currentId, choices }: { tenderId: string; currentId: string | null; choices: Choice[] }) {
  const [state, action, pending] = useActionState<AssignState, FormData>(assignTenderOwnerAction, {});
  const shown = choices.filter((c) => c.active || c.id === currentId);
  return (
    <form action={action} className="space-y-3 rounded-lg border border-line bg-surface p-5">
      <input type="hidden" name="tenderId" value={tenderId} />
      <h2 className="text-sm font-semibold">Tender owner</h2>
      <div className="md:max-w-sm">
        <label htmlFor="ownerId" className="text-sm font-medium">
          Responsible person
        </label>
        <select id="ownerId" name="ownerId" defaultValue={currentId ?? ""} className={fieldClass}>
          <option value="">Not assigned</option>
          {shown.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.active ? "" : " (turned off)"}
            </option>
          ))}
        </select>
        {choices.length === 0 ? <p className="mt-1 text-xs text-muted">The sales force is empty. Add people on the Sales force page first.</p> : null}
      </div>
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
        {pending ? "Saving…" : "Save owner"}
      </button>
    </form>
  );
}
