"use client";

import { useActionState, useState } from "react";
import { moveTenderAction, type TenderFormState } from "@/server/actions/tenders";
import { SubmitterField } from "@/components/submitter-field";
import { STAGE, STATUS_LABEL, neededFor, optionalFor, type TenderStatus } from "@/core/tender-flow";
import { FieldInput, HiddenField, fieldClass, type FieldValues } from "../tender-fields";

type Move = { to: TenderStatus; back: boolean };

const FIELD_KEYS = ["authority", "tenderNo", "title", "productLine", "estimatedValue", "deadline", "bidValue", "awardAmount", "closeReason", "closeReasonCode", "winnerName", "winningPrice", "expectedAwardDate", "submittedOn", "bidOpeningDate", "paymentTermsDays", "contractNo", "contractValue", "deliveredOn", "notes"] as const;

/**
 * Moves the tender to its next status. The panel asks for exactly the details that status needs and carries every other
 * value along unchanged, so a move never blanks anything.
 */
export function MovePanel({ tenderId, status, values, moves }: { tenderId: string; status: TenderStatus; values: FieldValues; moves: Move[] }) {
  const [state, action, pending] = useActionState<TenderFormState, FormData>(moveTenderAction, {});
  const [to, setTo] = useState<TenderStatus | null>(null);
  if (moves.length === 0) return <p className="rounded-lg border border-line bg-surface p-5 text-sm text-muted">No further change is open to your role for this tender.</p>;
  const needed = to ? neededFor(to).map((n) => n.key as string) : [];
  const optional = to ? optionalFor(to).map((n) => n.key as string) : [];
  const endsTender = to === "lost" || to === "cancelled";
  // A reason code of "other" is only useful with a note, so the note is shown whenever a tender ends.
  const shown = new Set([...needed, ...optional, ...(endsTender ? ["closeReason"] : [])]);

  return (
    <section aria-label="Move this tender" className="space-y-4 rounded-lg border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold">Move this tender</h2>
      <p className="text-xs text-muted">
        Now: <b>{STATUS_LABEL[status]}</b> (stage {STAGE[status].no} of 10). {STAGE[status].action}.
      </p>
      <div className="flex flex-wrap gap-2">
        {moves.map((m) => (
          <button
            key={m.to}
            type="button"
            onClick={() => setTo(m.to)}
            aria-pressed={to === m.to}
            className={`rounded-[7px] border px-3 py-2 text-sm ${to === m.to ? "border-brand bg-brand text-brand-ink" : "border-line bg-white hover:border-brand"}`}
          >
            {m.back ? "Step back to " : "Move to "}
            {STATUS_LABEL[m.to]}
          </button>
        ))}
      </div>
      {to ? (
        <form action={action} className="space-y-4 border-t border-dashed border-line pt-4" key={to}>
          <input type="hidden" name="tenderId" value={tenderId} />
          <input type="hidden" name="seenStatus" value={status} />
          <input type="hidden" name="to" value={to} />
          <p className="text-sm">
            <b>{STATUS_LABEL[to]}</b>: {STAGE[to].action}.
          </p>
          {FIELD_KEYS.filter((k) => shown.has(k)).map((k) => (
            <FieldInput key={k} name={k} value={values[k]} required={needed.includes(k)} endingAs={endsTender ? to! : undefined} />
          ))}
          {FIELD_KEYS.filter((k) => !shown.has(k)).map((k) => (
            <HiddenField key={k} name={k} value={values[k]} />
          ))}
          <div>
            <label htmlFor="move-note" className="text-sm font-medium">
              Note (optional)
            </label>
            <input id="move-note" name="note" maxLength={2000} autoComplete="off" className={fieldClass} />
          </div>
          <SubmitterField />
          {state.error ? (
            <p role="alert" className="text-sm text-bad">
              {state.error}
            </p>
          ) : null}
          {state.saved ? (
            <p role="status" className="text-sm text-brand">
              Moved to {STATUS_LABEL[to]}.
            </p>
          ) : null}
          <button type="submit" disabled={pending} className="rounded-[7px] bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-[#125747] disabled:opacity-60">
            {pending ? "Saving…" : `Confirm: ${STATUS_LABEL[to]}`}
          </button>
        </form>
      ) : null}
    </section>
  );
}
