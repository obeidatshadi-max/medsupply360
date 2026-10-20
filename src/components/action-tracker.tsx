"use client";

import { useActionState } from "react";
import { SubmitterField } from "@/components/submitter-field";
import { RESPONSIBLE, STATUS_LABEL, isOverdue } from "@/core/management-actions";
import { dayText } from "@/lib/format";
import { addActionAction, removeActionAction, setDoneAction, type ActionFormState } from "@/server/actions/management-actions";
import type { ActionItem } from "@/server/services/management-actions";

const field = "mt-1 block w-full rounded-md border border-line bg-white px-3 py-2 text-sm";
const submit = "rounded-[7px] bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-[#125747] disabled:opacity-60";

export function AddActionForm({ today, prefill }: { today: string; prefill: { title: string; evidence: string; responsible: string } }) {
  const [state, action, pending] = useActionState<ActionFormState, FormData>(addActionAction, {});
  return (
    <form id="add-action" action={action} className="space-y-4 rounded-lg border border-line bg-surface p-5">
      <h3 className="text-sm font-semibold">Assign a management action</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-medium md:col-span-2">
          Action
          <input name="title" required minLength={3} maxLength={180} defaultValue={prefill.title} placeholder="Look into the repeat purchase gap" className={field} />
        </label>
        <label className="text-sm font-medium">
          Responsible
          <select name="responsible" defaultValue={prefill.responsible} className={field}>
            {RESPONSIBLE.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Due date
          <input name="due" type="date" required defaultValue={today} className={field} />
        </label>
        <label className="text-sm font-medium md:col-span-2">
          Evidence
          <textarea name="evidence" rows={3} maxLength={1000} defaultValue={prefill.evidence} placeholder="What prompted this action" className={field} />
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
      <button type="submit" disabled={pending} className={submit}>
        {pending ? "Saving…" : "Assign action"}
      </button>
    </form>
  );
}

function DoneButton({ id, done }: { id: string; done: boolean }) {
  const [state, action, pending] = useActionState<ActionFormState, FormData>(setDoneAction, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="done" value={String(done)} />
      <SubmitterField compact />
      <button type="submit" disabled={pending} className="rounded-md border border-brand px-3 py-1.5 text-xs font-semibold text-brand disabled:opacity-60">
        {done ? "Mark done" : "Reopen"}
      </button>
      {state.error ? (
        <span role="alert" className="text-xs text-bad">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

function RemoveButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<ActionFormState, FormData>(removeActionAction, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <SubmitterField compact />
      <button type="submit" disabled={pending} className="rounded-md border border-bad px-3 py-1.5 text-xs font-semibold text-bad disabled:opacity-60">
        Remove
      </button>
      {state.error ? (
        <span role="alert" className="text-xs text-bad">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

/** The action list. `manage` shows the buttons; everyone else reads. */
export function ActionList({ actions, today, manage }: { actions: ActionItem[]; today: string; manage: boolean }) {
  if (actions.length === 0) return <p className="mt-2 text-sm text-muted">No management action yet.{manage ? " Assign the first one below, or from the “Assign action” buttons on other screens." : ""}</p>;
  return (
    <div className="mt-2 space-y-3">
      {actions.map((a) => {
        const late = isOverdue(a, today);
        return (
          <article key={a.id} className="rounded-lg border border-line bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{a.title}</p>
                {a.evidence ? <p className="mt-0.5 text-xs text-muted">{a.evidence}</p> : null}
                <p className="mt-1 text-xs text-muted">
                  {a.responsible} · due {dayText(a.due)}
                  {a.createdBy ? ` · added by ${a.createdBy}` : ""}
                  {a.status === "done" && a.completedOn ? ` · done ${dayText(a.completedOn)}${a.completedBy ? ` by ${a.completedBy}` : ""}` : ""}
                </p>
              </div>
              <span className={`rounded px-2 py-0.5 text-xs ${late ? "bg-bad-soft text-bad" : a.status === "done" ? "bg-brand-soft text-ink" : "border border-line bg-white"}`}>{late ? "Overdue" : STATUS_LABEL[a.status]}</span>
            </div>
            {manage ? (
              <div className="mt-3 flex flex-wrap gap-4 border-t border-line pt-3">
                <DoneButton id={a.id} done={a.status === "open"} />
                <RemoveButton id={a.id} />
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
