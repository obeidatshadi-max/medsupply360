"use client";

import { useActionState, useState, useTransition } from "react";
import { importAction, type ImportActionState } from "@/server/actions/imports";
import { SPECS, type ImportKind } from "@/core/import/specs";

/** Master data first: sales, receipts and stock rows point at product and customer codes that must already exist. */
const ORDER: ImportKind[] = ["products", "customers", "sales", "receipts", "open_invoices", "stock_snapshot", "stock_transactions", "installed_units"];

const field = "mt-1 block w-full rounded-md border border-line bg-white px-3 py-2 text-sm";

export function ImportForm() {
  const [state, action, actionPending] = useActionState<ImportActionState, FormData>(importAction, {});
  const [transitioning, startTransition] = useTransition();
  const pending = actionPending || transitioning;
  const [kind, setKind] = useState<ImportKind>("products");
  const needsSnapshot = SPECS[kind].snapshot === true;

  // Submitted by hand instead of through `<form action>`: React resets a form after its action finishes, which cleared
  // the chosen file and file type, so "Check file" then "Import" meant choosing both again.
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    startTransition(() => action(data));
  };

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-line bg-surface p-5">
        <div>
          <label htmlFor="kind" className="text-sm font-medium">
            Type of file
          </label>
          <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as ImportKind)} className={field}>
            {ORDER.map((k) => (
              <option key={k} value={k}>
                {SPECS[k].title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="file" className="text-sm font-medium">
            CSV file
          </label>
          <input id="file" name="file" type="file" accept=".csv,text/csv" required className={field} />
          <p className="mt-1 text-xs text-muted">UTF-8 CSV, up to 4.5 MB. For large sales files, export one month at a time.</p>
        </div>
        {needsSnapshot ? (
          <div>
            <label htmlFor="snapshotDate" className="text-sm font-medium">
              Snapshot date
            </label>
            <input id="snapshotDate" name="snapshotDate" type="date" className={field} />
            <p className="mt-1 text-xs text-muted">
              Only needed if the file has no snapshot date column. A complete file replaces that date. If any row fails, nothing is replaced. Other dates are kept separately.
            </p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button type="submit" name="mode" value="check" disabled={pending} className="rounded-md border border-brand px-4 py-2 text-sm font-semibold text-brand disabled:opacity-60">
            {pending ? "Working…" : "Check file (changes nothing)"}
          </button>
          <button type="submit" name="mode" value="import" disabled={pending} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-60">
            Import
          </button>
        </div>
      </form>

      {state.error ? (
        <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">
          {state.error}
        </p>
      ) : null}
      {state.outcome ? <Result fileName={state.fileName ?? ""} outcome={state.outcome} /> : null}
    </div>
  );
}

function Result({ fileName, outcome }: { fileName: string; outcome: NonNullable<ImportActionState["outcome"]> }) {
  if (outcome.state !== "done") {
    return (
      <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">
        {outcome.message}
      </p>
    );
  }
  const headline = outcome.dryRun
    ? `Check only: nothing was saved. ${outcome.rowsAccepted} of ${outcome.rowsTotal} rows are ready to import.`
    : outcome.status === "rejected"
      ? `Nothing was imported: all ${outcome.rowsTotal} rows were rejected.`
      : outcome.status === "partial"
        ? `Imported ${outcome.rowsAccepted} of ${outcome.rowsTotal} rows. ${outcome.rowsRejected} ${outcome.rowsRejected === 1 ? "row was" : "rows were"} rejected: fix ${outcome.rowsRejected === 1 ? "it" : "them"} in the file and import it again.`
        : `Imported all ${outcome.rowsTotal} rows.`;

  return (
    <section aria-label="Import result" className="space-y-4 rounded-lg border border-line bg-surface p-5">
      <div>
        <p className="text-xs text-muted">{fileName}</p>
        <p className="mt-1 text-sm font-semibold">{headline}</p>
        {outcome.message ? <p role="alert" className="mt-2 text-sm text-bad">{outcome.message}</p> : null}
      </div>

      {outcome.summary.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold">Check these against Alpha</h3>
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
            {outcome.summary.map((l) => (
              <div key={l.label} className="contents">
                <dt className="text-muted">{l.label}</dt>
                <dd className="text-right tabular-nums">{l.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {outcome.mappedColumns.length > 0 ? <details className="text-sm">
        <summary className="cursor-pointer font-semibold">Check which Alpha columns were matched</summary>
        <dl className="mt-2 grid grid-cols-2 gap-2">{outcome.mappedColumns.map((m) => <div key={m.field}>
          <dt className="text-muted">{m.field}</dt><dd>{m.sourceColumn}</dd>
        </div>)}</dl>
      </details> : null}
      {outcome.ignoredColumns.length > 0 ? <p className="text-xs text-muted">Columns not used: {outcome.ignoredColumns.join(", ")}</p> : null}

      {outcome.rejections.length > 0 ? (
        <IssueList title={`Rejected rows (${outcome.rowsRejected})`} tone="bad" issues={outcome.rejections} hidden={outcome.rejectionsHidden} />
      ) : null}
      {outcome.warnings.length > 0 ? (
        <IssueList title={`Loaded with a gap (${outcome.warnings.length + outcome.warningsHidden})`} tone="gold" issues={outcome.warnings} hidden={outcome.warningsHidden} />
      ) : null}
    </section>
  );
}

function IssueList({ title, tone, issues, hidden }: { title: string; tone: "bad" | "gold"; issues: { row: number; reason: string }[]; hidden: number }) {
  return (
    <div>
      <h3 className={`text-sm font-semibold ${tone === "bad" ? "text-bad" : "text-gold"}`}>{title}</h3>
      <ul className="mt-2 max-h-72 space-y-1 overflow-auto text-sm">
        {issues.map((i, n) => (
          <li key={`${i.row}-${n}`}>
            <span className="font-medium tabular-nums">Row {i.row}:</span> {i.reason}
          </li>
        ))}
      </ul>
      {hidden > 0 ? <p className="mt-1 text-xs text-muted">and {hidden} more. Fix these first, then check the file again.</p> : null}
    </div>
  );
}
