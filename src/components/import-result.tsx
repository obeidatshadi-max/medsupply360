import type { ImportActionState } from "@/server/actions/imports";

export function ImportResult({ fileName, outcome }: { fileName: string; outcome: NonNullable<ImportActionState["outcome"]> }) {
  if (outcome.state !== "done") {
    return (
      <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">
        {fileName}: {outcome.message}
      </p>
    );
  }
  const headline = outcome.dryRun
    ? `Preview, nothing saved yet. ${outcome.rowsAccepted} of ${outcome.rowsTotal} rows are ready to import.`
    : outcome.status === "rejected"
      ? `Nothing was imported: all ${outcome.rowsTotal} rows were rejected.`
      : outcome.status === "partial"
        ? `Imported ${outcome.rowsAccepted} of ${outcome.rowsTotal} rows. ${outcome.rowsRejected} ${outcome.rowsRejected === 1 ? "row was" : "rows were"} rejected: fix ${outcome.rowsRejected === 1 ? "it" : "them"} in the file and import it again.`
        : `Imported all ${outcome.rowsTotal} ${outcome.rowsTotal === 1 ? "row" : "rows"}.`;

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
