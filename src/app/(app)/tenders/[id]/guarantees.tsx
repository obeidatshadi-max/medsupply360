"use client";

import { useActionState } from "react";
import { addGuaranteeAction, deleteGuaranteeAction, updateGuaranteeAction, type FinanceFormState } from "@/server/actions/tender-finance";
import { SubmitterField } from "@/components/submitter-field";
import { GUARANTEE_KINDS, GUARANTEE_LABEL, guaranteeState } from "@/core/tender-money";
import type { GuaranteeRow } from "@/server/services/tender-finance";
import { dayText, jod } from "@/lib/format";
import { fieldClass } from "../tender-fields";

const money = (n: number) => String(n);

function Fields({ g }: { g?: GuaranteeRow }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div>
        <label className="text-sm font-medium">Type</label>
        <select name="kind" defaultValue={g?.kind ?? "bid"} className={fieldClass}>
          {GUARANTEE_KINDS.map((k) => (
            <option key={k} value={k}>
              {GUARANTEE_LABEL[k]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">Amount (JOD)</label>
        <input name="amount" required inputMode="decimal" defaultValue={g ? money(g.amount) : ""} autoComplete="off" className={fieldClass} />
      </div>
      <div>
        <label className="text-sm font-medium">Bank reference</label>
        <input name="reference" maxLength={80} defaultValue={g?.reference ?? ""} autoComplete="off" className={fieldClass} />
      </div>
      <div>
        <label className="text-sm font-medium">Issued on</label>
        <input name="issuedOn" type="date" defaultValue={g?.issuedOn ?? ""} className={fieldClass} />
      </div>
      <div>
        <label className="text-sm font-medium">Expires on</label>
        <input name="expiresOn" type="date" required defaultValue={g?.expiresOn ?? ""} className={fieldClass} />
      </div>
      <div>
        <label className="text-sm font-medium">Returned on</label>
        <input name="returnedOn" type="date" defaultValue={g?.returnedOn ?? ""} className={fieldClass} />
      </div>
    </div>
  );
}

function Message({ state }: { state: FinanceFormState }) {
  if (state.error)
    return (
      <p role="alert" className="text-sm text-bad">
        {state.error}
      </p>
    );
  if (state.saved)
    return (
      <p role="status" className="text-sm text-brand">
        Saved.
      </p>
    );
  return null;
}

function statusText(g: GuaranteeRow, today: string): { text: string; tone: string } {
  const s = guaranteeState(g, today);
  if (s.state === "returned") return { text: "Returned", tone: "text-muted" };
  if (s.state === "expired") return { text: `Expired ${s.daysAgo} day${s.daysAgo === 1 ? "" : "s"} ago, not yet returned`, tone: "text-bad" };
  return { text: s.daysLeft === 0 ? "Expires today" : `${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"} left`, tone: "text-brand" };
}

function EditRow({ tenderId, g, today, canEdit }: { tenderId: string; g: GuaranteeRow; today: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState<FinanceFormState, FormData>(updateGuaranteeAction, {});
  const st = statusText(g, today);
  return (
    <li className="rounded-lg border border-line bg-white p-4">
      <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span>
          <b>{GUARANTEE_LABEL[g.kind]}</b> · <span className="tabular-nums">{jod(g.amount)}</span>
          {g.reference ? <span className="text-xs text-muted"> · {g.reference}</span> : null}
        </span>
        <span className={`text-xs ${st.tone}`}>{st.text}</span>
      </p>
      <p className="mt-1 text-xs text-muted">
        {g.issuedOn ? `Issued ${dayText(g.issuedOn)} · ` : ""}Expires {dayText(g.expiresOn)}
        {g.returnedOn ? ` · Returned ${dayText(g.returnedOn)}` : ""}
      </p>
      {canEdit ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs underline underline-offset-2">Change or remove</summary>
          <form action={action} className="mt-3 space-y-3">
            <input type="hidden" name="tenderId" value={tenderId} />
            <input type="hidden" name="guaranteeId" value={g.id} />
            <Fields g={g} />
            <SubmitterField />
            <Message state={state} />
            <button type="submit" disabled={pending} className="rounded-[7px] border border-line bg-white px-3 py-1.5 text-xs font-semibold hover:border-brand disabled:opacity-60">
              {pending ? "Saving…" : "Save changes"}
            </button>
          </form>
          <form action={deleteGuaranteeAction} className="mt-2 flex flex-wrap items-center gap-2">
            <input type="hidden" name="tenderId" value={tenderId} />
            <input type="hidden" name="guaranteeId" value={g.id} />
            <SubmitterField compact />
            <button type="submit" className="text-xs text-bad underline underline-offset-2">
              Remove this guarantee (entered by mistake)
            </button>
          </form>
        </details>
      ) : null}
    </li>
  );
}

export function Guarantees({ tenderId, rows, today, canEdit }: { tenderId: string; rows: GuaranteeRow[]; today: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState<FinanceFormState, FormData>(addGuaranteeAction, {});
  return (
    <section aria-label="Guarantees" className="space-y-3">
      <h2 className="text-sm font-semibold">Guarantees</h2>
      {rows.length === 0 ? <p className="text-sm text-muted">No guarantee recorded for this tender.</p> : null}
      <ul className="space-y-2">
        {rows.map((g) => (
          <EditRow key={g.id} tenderId={tenderId} g={g} today={today} canEdit={canEdit} />
        ))}
      </ul>
      {canEdit ? (
        <form action={action} className="space-y-3 rounded-lg border border-line bg-surface p-5">
          <input type="hidden" name="tenderId" value={tenderId} />
          <p className="text-sm font-medium">Add a guarantee</p>
          <Fields />
          <SubmitterField />
          <Message state={state} />
          <button type="submit" disabled={pending} className="rounded-[7px] border border-line bg-white px-4 py-2 text-sm font-semibold hover:border-brand disabled:opacity-60">
            {pending ? "Saving…" : "Add guarantee"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
