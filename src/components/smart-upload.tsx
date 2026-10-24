"use client";

import { useId, useState } from "react";
import { importAction, type ImportActionState } from "@/server/actions/imports";
import { CHANNEL_INFO, channelOfKind } from "@/core/channels";
import { detectKind, IMPORT_ORDER } from "@/core/import/detect";
import { validateImport } from "@/core/import/validate";
import { SPECS, type ImportKind } from "@/core/import/specs";
import { readWorkbook, type SheetGrid } from "@/core/import/workbook";
import { ImportResult } from "@/components/import-result";
import { SubmitterField } from "@/components/submitter-field";

const HEADER_BYTES = 8192;
const field = "mt-1 block w-full rounded-md border border-line bg-white px-3 py-2 text-sm";

/** One thing to upload: a CSV file, or one tab of a workbook turned into CSV. */
type Item = {
  id: number;
  /** What the person picked, e.g. "template.xlsx". */
  source: string;
  /** The tab, for a workbook. */
  sheet: string | null;
  kind: ImportKind | "";
  /** "recognised" = read from the headings; "chosen" = picked by the person. */
  how: "recognised" | "chosen" | "unknown";
  /** A type that was recognised but belongs in another channel. */
  elsewhere: ImportKind | null;
  rows: number | null;
  headerRow: number;
  snapshotDate: string;
  /** Why this item is not uploaded (guide tab, empty tab). */
  skipped: string | null;
  file: File;
};
type Run = { id: number; label: string; state: ImportActionState | "skipped" | "working" };

let nextId = 1;
const label = (i: Item) => (i.sheet ? `${i.source} · ${i.sheet}` : i.source);

/** The codes defined by the customer and product lists in an upload, taken from the rows that pass their own checks. */
async function announcedCodes(queue: Item[]): Promise<{ customers: string[]; products: string[] }> {
  const today = new Date().toISOString().slice(0, 10);
  const out = { customers: [] as string[], products: [] as string[] };
  for (const item of queue) {
    if (item.kind !== "customers" && item.kind !== "products") continue;
    const result = validateImport(item.kind, await item.file.text(), { today, snapshotDate: item.snapshotDate || undefined });
    for (const row of result.accepted) {
      const code = row.values.code;
      if (typeof code === "string" && code !== "") out[item.kind === "customers" ? "customers" : "products"].push(code);
    }
  }
  return out;
}

export function SmartUpload({ allowed, noun }: { allowed: readonly ImportKind[]; noun: string }) {
  const inputId = useId();
  const [items, setItems] = useState<Item[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const usable = items.filter((i) => i.skipped === null);
  const order = (list: Item[]) => [...list].sort((a, b) => IMPORT_ORDER.indexOf(a.kind as ImportKind) - IMPORT_ORDER.indexOf(b.kind as ImportKind));

  // Read what was picked: a workbook gives one item per tab, a CSV gives one item. The type of each comes from its headings.
  const pick = async (files: FileList | null) => {
    setError(null);
    setRuns([]);
    setChecked(false);
    const made: Item[] = [];
    try {
      for (const file of Array.from(files ?? [])) {
        if (/\.xlsx$/i.test(file.name)) {
          const { default: readXlsxFile } = await import("read-excel-file/browser");
          const sheets = (await readXlsxFile(file)) as SheetGrid[];
          for (const s of readWorkbook(sheets, allowed)) {
            const hint = s.kind === null && s.candidates[0] ? s.candidates[0] : null;
            made.push({
              id: nextId++,
              source: file.name,
              sheet: s.sheet,
              kind: s.kind ?? "",
              how: s.kind ? "recognised" : "unknown",
              elsewhere: hint && !allowed.includes(hint) ? hint : null,
              rows: s.rows,
              headerRow: s.headerRow,
              snapshotDate: "",
              skipped: s.skipped,
              file: new File([s.csv], `${file.name.replace(/\.xlsx$/i, "")} - ${s.sheet}.csv`, { type: "text/csv" }),
            });
          }
        } else {
          const found = detectKind(await file.slice(0, HEADER_BYTES).text());
          const kind = found.kind !== null && allowed.includes(found.kind) ? found.kind : null;
          made.push({
            id: nextId++,
            source: file.name,
            sheet: null,
            kind: kind ?? "",
            how: kind ? "recognised" : "unknown",
            elsewhere: found.kind !== null && kind === null ? found.kind : null,
            rows: null,
            headerRow: 1,
            snapshotDate: "",
            skipped: null,
            file,
          });
        }
      }
    } catch {
      setError("A file could not be read. Use a .xlsx workbook or a UTF-8 .csv file, and make sure it is not password protected.");
      return;
    }
    setItems(made);
    await run(made, "check");
  };

  const change = async (id: number, patch: Partial<Item>) => {
    const next = items.map((i) => (i.id === id ? { ...i, ...patch } : i));
    setItems(next);
    setChecked(false);
    await run(next, "check");
  };

  // Every item goes to the server on its own request (a request body is capped near 6 MB), in the order the data
  // needs. A check changes nothing; the confirm button repeats the same requests with mode "import".
  const run = async (list: Item[], mode: "check" | "import", form?: HTMLFormElement) => {
    const queue = order(list.filter((i) => i.skipped === null && i.kind !== ""));
    if (queue.length === 0) {
      setRuns([]);
      return;
    }
    setBusy(true);
    setError(null);
    const done: Run[] = [];
    const base = form ? new FormData(form) : new FormData();
    base.delete("files");
    // A check looks at each file on its own against what is already saved, so tell it which customers and products the
    // lists in this same upload add. Without this a first load shows every sales file as full of unknown codes.
    const assumed = mode === "check" ? await announcedCodes(queue) : null;
    try {
      for (const [n, item] of queue.entries()) {
        done.push({ id: item.id, label: label(item), state: "working" });
        setRuns([...done]);
        const data = new FormData();
        for (const [k, v] of base.entries()) data.append(k, v);
        data.set("mode", mode);
        data.set("kind", item.kind);
        data.set("snapshotDate", item.snapshotDate);
        data.set("file", item.file);
        if (assumed) {
          data.set("assumeCustomers", assumed.customers.join("\n"));
          data.set("assumeProducts", assumed.products.join("\n"));
        }
        const state = await importAction({}, data);
        done[done.length - 1] = { id: item.id, label: label(item), state };
        setRuns([...done]);
        const stopped = state.error !== undefined || state.outcome?.state !== "done" || state.outcome.status === "rejected";
        if (mode === "import" && stopped) {
          for (const rest of queue.slice(n + 1)) done.push({ id: rest.id, label: label(rest), state: "skipped" });
          setRuns([...done]);
          break;
        }
      }
      if (mode === "check") setChecked(true);
    } catch {
      setError("The upload was interrupted. Check Recent imports to see what was saved, then try the rest again.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setChecked(false);
    await run(items, "import", e.currentTarget);
  };

  const ready = usable.filter((i) => i.kind !== "").length;
  const unclear = usable.filter((i) => i.kind === "");

  return (
    <div className="space-y-5">
      <form onSubmit={confirm} className="space-y-4 rounded-lg border border-line bg-surface p-5">
        <div>
          <label htmlFor={inputId} className="text-sm font-medium">
            Excel workbook or CSV files
          </label>
          <input id={inputId} name="files" type="file" multiple accept=".xlsx,.csv,text/csv" onChange={(e) => void pick(e.target.files)} className={field} />
          <p className="mt-1 text-xs text-muted">
            Drop {noun}. Every tab of a workbook is read on its own and its type is recognised from the column headings, even when the headings start a few rows down. You see what was understood below before anything is saved.
          </p>
        </div>

        {items.length > 0 ? (
          <ul className="divide-y divide-line rounded-md border border-line bg-white text-sm">
            {items.map((i) => (
              <li key={i.id} className="grid gap-2 px-3 py-2 md:grid-cols-[1fr_16rem_10rem] md:items-center">
                <span className="truncate" title={label(i)}>
                  {label(i)}
                  <span className="block text-xs text-muted">{note(i)}</span>
                </span>
                {i.skipped === null ? (
                  <select
                    aria-label={`Type of ${label(i)}`}
                    value={i.kind}
                    onChange={(e) => void change(i.id, { kind: e.target.value as ImportKind | "", how: "chosen" })}
                    className="rounded-md border border-line bg-white px-2 py-1.5 text-sm"
                  >
                    <option value="">Choose the type…</option>
                    {allowed.map((k) => (
                      <option key={k} value={k}>
                        {SPECS[k].title}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-muted">Not uploaded</span>
                )}
                {i.skipped === null && i.kind !== "" && SPECS[i.kind].snapshot === true ? (
                  <input aria-label={`Snapshot date of ${label(i)}`} type="date" value={i.snapshotDate} onChange={(e) => void change(i.id, { snapshotDate: e.target.value })} className="rounded-md border border-line bg-white px-2 py-1.5 text-sm" />
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
        ) : null}
        {unclear.length > 0 ? <p className="text-xs text-gold">{unclear.length === 1 ? "One tab is" : `${unclear.length} tabs are`} not recognised. Choose the type above, or leave {unclear.length === 1 ? "it" : "them"} out of the upload.</p> : null}

        <SubmitterField />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy || !checked || ready === 0} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-60">
            {busy ? "Working…" : ready > 1 ? `Confirm and save ${ready} files` : "Confirm and save"}
          </button>
          <span className="text-xs text-muted">{ready === 0 ? "Nothing to save yet." : checked ? "Preview is ready below. Nothing is saved until you confirm." : "Reading and checking…"}</span>
        </div>
      </form>

      {error ? (
        <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">
          {error}
        </p>
      ) : null}
      {runs.map((r) =>
        r.state === "working" ? (
          <p key={r.id} className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-muted">
            {r.label}: working…
          </p>
        ) : r.state === "skipped" ? (
          <p key={r.id} className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-muted">
            {r.label}: not saved, because an earlier file could not be loaded. Fix that file first, then upload again.
          </p>
        ) : r.state.error ? (
          <p key={r.id} role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">
            {r.label}: {r.state.error}
          </p>
        ) : r.state.outcome ? (
          <ImportResult key={r.id} fileName={r.label} outcome={r.state.outcome} />
        ) : null,
      )}
    </div>
  );
}

/** The grey line under a file name: what was understood, in words. */
function note(i: Item): string {
  if (i.skipped !== null) return i.skipped;
  const rows = i.rows === null ? "" : ` · ${i.rows} row${i.rows === 1 ? "" : "s"}`;
  const head = i.headerRow > 1 ? ` · headings found on row ${i.headerRow}` : "";
  if (i.kind === "") {
    return i.elsewhere
      ? `Looks like ${SPECS[i.elsewhere].title}, which belongs in ${CHANNEL_INFO[channelOfKind(i.elsewhere)].title}. Upload it there.`
      : `Type not recognised${rows}: choose it`;
  }
  return `${i.how === "recognised" ? "Type recognised from the headings" : "Type chosen by you"}${rows}${head}`;
}
