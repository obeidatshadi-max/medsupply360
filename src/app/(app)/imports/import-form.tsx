"use client";

import { useId, useState } from "react";
import { importAction, type ImportActionState } from "@/server/actions/imports";
import { detectKind, IMPORT_ORDER } from "@/core/import/detect";
import { SPECS, type ImportKind } from "@/core/import/specs";
import { SubmitterField } from "@/components/submitter-field";

const field = "mt-1 block w-full rounded-md border border-line bg-white px-3 py-2 text-sm";
const HEADER_BYTES = 8192;

type Item = { id: number; file: File; kind: ImportKind | ""; guessed: boolean; snapshotDate: string };
type Run = { id: number; fileName: string; title: string; state: ImportActionState | "skipped" };

let nextId = 1;

export function ImportForm() {
  const inputId = useId();
  const [items, setItems] = useState<Item[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The type is read from each file's header row; the person can change it, or choose one when it could not be told.
  const pick = async (files: FileList | null) => {
    setError(null);
    setRuns([]);
    const chosen = Array.from(files ?? []);
    const next = await Promise.all(
      chosen.map(async (file): Promise<Item> => {
        const found = detectKind(await file.slice(0, HEADER_BYTES).text());
        return { id: nextId++, file, kind: found.kind ?? "", guessed: found.kind !== null, snapshotDate: "" };
      }),
    );
    setItems(next);
  };

  const change = (id: number, patch: Partial<Item>) => setItems((all) => all.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  // Submitted by hand: every file goes to the server on its own request (a request body is capped near 6 MB), in the
  // order the importer needs, and the form keeps its files so "Check" then "Import" does not mean choosing them again.
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const base = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    const mode = String(base.get("mode"));
    base.delete("files");
    if (items.length === 0) return setError("Choose at least one CSV file.");
    const untyped = items.find((i) => i.kind === "");
    if (untyped) return setError(`Choose the type of file for ${untyped.file.name}.`);

    const queue = [...items].sort((a, b) => IMPORT_ORDER.indexOf(a.kind as ImportKind) - IMPORT_ORDER.indexOf(b.kind as ImportKind));
    setError(null);
    setBusy(true);
    setRuns([]);
    const done: Run[] = [];
    try {
      for (const [n, item] of queue.entries()) {
        const kind = item.kind as ImportKind;
        const data = new FormData();
        for (const [k, v] of base.entries()) data.append(k, v);
        data.set("kind", kind);
        data.set("snapshotDate", item.snapshotDate);
        data.set("file", item.file);
        const state = await importAction({}, data);
        done.push({ id: item.id, fileName: item.file.name, title: SPECS[kind].title, state });
        setRuns([...done]);
        // A real import stops at a file that could not be loaded at all: later files point at its codes.
        const stopped = state.error !== undefined || state.outcome?.state !== "done" || state.outcome.status === "rejected";
        if (mode === "import" && stopped) {
          for (const rest of queue.slice(n + 1)) done.push({ id: rest.id, fileName: rest.file.name, title: SPECS[rest.kind as ImportKind].title, state: "skipped" });
          setRuns([...done]);
          break;
        }
      }
    } catch {
      setError("The import was interrupted. Check the Recent imports list below to see which files were loaded, then try the rest again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-line bg-surface p-5">
        <div>
          <label htmlFor={inputId} className="text-sm font-medium">
            CSV files
          </label>
          <input id={inputId} name="files" type="file" multiple accept=".csv,text/csv" onChange={(e) => void pick(e.target.files)} className={field} />
          <p className="mt-1 text-xs text-muted">
            Choose one file or several at once. Each file&rsquo;s type is read from its column headings, and the files are loaded in the right order (products and customers first). UTF-8 CSV, up to 4.5 MB each. For large sales files, export one month at a time.
          </p>
        </div>
        {items.length > 0 ? (
          <ul className="divide-y divide-line rounded-md border border-line bg-white text-sm">
            {items.map((i) => (
              <li key={i.id} className="grid gap-2 px-3 py-2 md:grid-cols-[1fr_16rem_10rem] md:items-center">
                <span className="truncate" title={i.file.name}>
                  {i.file.name}
                  <span className="block text-xs text-muted">{i.kind === "" ? "Type not recognised: choose it" : i.guessed ? "Type recognised from the headings" : "Type chosen by you"}</span>
                </span>
                <select
                  aria-label={`Type of ${i.file.name}`}
                  value={i.kind}
                  onChange={(e) => change(i.id, { kind: e.target.value as ImportKind | "", guessed: false })}
                  className="rounded-md border border-line bg-white px-2 py-1.5 text-sm"
                >
                  <option value="">Choose the type…</option>
                  {IMPORT_ORDER.map((k) => (
                    <option key={k} value={k}>
                      {SPECS[k].title}
                    </option>
                  ))}
                </select>
                {i.kind !== "" && SPECS[i.kind].snapshot === true ? (
                  <input aria-label={`Snapshot date of ${i.file.name}`} type="date" value={i.snapshotDate} onChange={(e) => change(i.id, { snapshotDate: e.target.value })} className="rounded-md border border-line bg-white px-2 py-1.5 text-sm" />
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
        ) : null}
        {items.some((i) => i.kind !== "" && SPECS[i.kind].snapshot === true) ? (
          <p className="text-xs text-muted">
            Snapshot date: only needed for a file with no snapshot date column. A complete file replaces that date. If any row fails, nothing is replaced. Other dates are kept separately.
          </p>
        ) : null}
        <SubmitterField />
        <div className="flex flex-wrap gap-3">
          <button type="submit" name="mode" value="check" formNoValidate disabled={busy} className="rounded-md border border-brand px-4 py-2 text-sm font-semibold text-brand disabled:opacity-60">
            {busy ? "Working…" : items.length > 1 ? "Check files (changes nothing)" : "Check file (changes nothing)"}
          </button>
          <button type="submit" name="mode" value="import" disabled={busy} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-60">
            {items.length > 1 ? "Import all" : "Import"}
          </button>
        </div>
      </form>

      {error ? (
        <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">
          {error}
        </p>
      ) : null}
      {runs.map((r) =>
        r.state === "skipped" ? (
          <p key={r.id} className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-muted">
            {r.fileName} ({r.title}): not imported, because an earlier file could not be loaded. Fix that file first, then import again.
          </p>
        ) : r.state.error ? (
          <p key={r.id} role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">
            {r.fileName}: {r.state.error}
          </p>
        ) : r.state.outcome ? (
          <Result key={r.id} fileName={`${r.fileName} · ${r.title}`} outcome={r.state.outcome} />
        ) : null,
      )}
    </div>
  );
}

function Result({ fileName, outcome }: { fileName: string; outcome: NonNullable<ImportActionState["outcome"]> }) {
  if (outcome.state !== "done") {
    return (
      <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">
        {fileName}: {outcome.message}
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
