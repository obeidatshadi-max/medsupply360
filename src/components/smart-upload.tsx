"use client";

import { useId, useRef, useState } from "react";
import { importAction, type ImportActionState } from "@/server/actions/imports";
import { CHANNEL_INFO, channelOfKind } from "@/core/channels";
import { applyMapping, columnReport, fieldLabel, headerOf, remember, rememberedMapping, suggestColumn, type ColumnReport, type Mapping, type Remembered } from "@/core/import/column-map";
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
  /** What goes to the server: the original file with any chosen column names applied. */
  file: File;
  /** The file as it was read, before column naming. */
  original: File;
  /** Importer field -> heading in the file, as chosen (or remembered) for this file. */
  mapping: Mapping;
  /** Which fields and headings the file has before any naming; null until a type is known. */
  raw: ColumnReport | null;
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

/** Applies the chosen (or, when `explicit` is null, remembered) column names to a file whose type is known. */
async function prepare(item: Item, remembered: Remembered, explicit: Mapping | null): Promise<Item> {
  if (item.skipped !== null || item.kind === "") return { ...item, file: item.original, mapping: {}, raw: null };
  const text = await item.original.text();
  const raw = columnReport(item.kind, headerOf(text));
  const mapping = explicit ?? rememberedMapping(item.kind, raw.unused, remembered);
  const file = Object.keys(mapping).length === 0 ? item.original : new File([applyMapping(item.kind, text, mapping)], item.original.name, { type: "text/csv" });
  return { ...item, file, mapping, raw };
}

const storeKey = (companyId: string) => `sadaf-column-map:${companyId}`;

export function SmartUpload({ allowed, noun, companyId }: { allowed: readonly ImportKind[]; noun: string; companyId: string }) {
  const inputId = useId();
  const [items, setItems] = useState<Item[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saved = useRef<Remembered | null>(null);

  // Column names the person chose before stay in this browser, per company. Storage can be blocked: then nothing is remembered.
  const remembered = (): Remembered => {
    if (saved.current === null) {
      try {
        const parsed: unknown = JSON.parse(window.localStorage.getItem(storeKey(companyId)) ?? "{}");
        saved.current = parsed !== null && typeof parsed === "object" ? (parsed as Remembered) : {};
      } catch {
        saved.current = {};
      }
    }
    return saved.current;
  };
  const persist = (next: Remembered) => {
    saved.current = next;
    try {
      window.localStorage.setItem(storeKey(companyId), JSON.stringify(next));
    } catch {
      /* private window or blocked storage: the choice still applies to this upload */
    }
  };

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
            const csvFile = new File([s.csv], `${file.name.replace(/\.xlsx$/i, "")} - ${s.sheet}.csv`, { type: "text/csv" });
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
              file: csvFile,
              original: csvFile,
              mapping: {},
              raw: null,
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
            original: file,
            mapping: {},
            raw: null,
          });
        }
      }
    } catch {
      setError("A file could not be read. Use a .xlsx workbook or a UTF-8 .csv file, and make sure it is not password protected.");
      return;
    }
    const prepared = await Promise.all(made.map((i) => prepare(i, remembered(), null)));
    setItems(prepared);
    await run(prepared, "check");
  };

  const change = async (id: number, patch: Partial<Item>) => {
    const next = await Promise.all(
      items.map((i) => {
        if (i.id !== id) return i;
        const changed = { ...i, ...patch };
        // A new type means different fields: start again from what was remembered for it.
        return patch.kind !== undefined ? prepare(changed, remembered(), null) : changed;
      }),
    );
    setItems(next);
    setChecked(false);
    await run(next, "check");
  };

  // The person says which column holds a field ("" clears it). The choice is remembered for next time.
  const mapField = async (id: number, fieldKey: string, heading: string) => {
    const item = items.find((i) => i.id === id);
    if (!item || item.kind === "") return;
    const mapping = { ...item.mapping };
    const previous = mapping[fieldKey];
    if (heading === "") delete mapping[fieldKey];
    else mapping[fieldKey] = heading;
    persist(remember(remembered(), item.kind, fieldKey, heading, previous));
    const next = await Promise.all(items.map((i) => (i.id === id ? prepare(i, remembered(), mapping) : i)));
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
                {i.skipped === null && i.kind !== "" && i.raw !== null ? <ColumnPicker item={i} onMap={(fieldKey, heading) => void mapField(i.id, fieldKey, heading)} /> : null}
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

/**
 * Lets the person say which column holds each field the file's headings did not name. Required fields come first and
 * must be filled for the file to load; the rest are optional extras. A suggestion is only a button, never applied alone.
 */
function ColumnPicker({ item, onMap }: { item: Item; onMap: (fieldKey: string, heading: string) => void }) {
  const raw = item.raw;
  if (raw === null || raw.ambiguous) return null;
  const required = raw.missingRequired;
  const optional = raw.unused.length > 0 ? raw.missingOptional : [];
  if (required.length === 0 && optional.length === 0) return null;
  const row = (f: (typeof required)[number]) => {
    const chosen = item.mapping[f.key] ?? "";
    // A heading already given to another field is not offered again.
    const taken = new Set(Object.entries(item.mapping).filter(([k]) => k !== f.key).map(([, h]) => h));
    const options = raw.unused.filter((h) => !taken.has(h));
    const hint = chosen === "" ? suggestColumn(f, options) : null;
    return (
      <div key={f.key} className="flex flex-wrap items-center gap-2 text-xs">
        <span className="w-44 shrink-0">
          {fieldLabel(f)}
          {f.required ? <span className="text-bad"> *</span> : null}
        </span>
        <select aria-label={`Column for ${fieldLabel(f)} in ${item.source}`} value={chosen} onChange={(e) => onMap(f.key, e.target.value)} className="rounded-md border border-line bg-white px-2 py-1">
          <option value="">{f.required ? "Choose the column…" : "Not in the file"}</option>
          {options.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        {hint ? (
          <button type="button" onClick={() => onMap(f.key, hint)} className="text-brand underline underline-offset-2">
            Use “{hint}”?
          </button>
        ) : null}
      </div>
    );
  };
  return (
    <div className="space-y-2 rounded-md border border-gold bg-surface px-3 py-2 md:col-span-3">
      {required.length > 0 ? (
        <>
          <p className="text-xs font-medium">The importer needs these columns but could not find them by name. Pick the matching column from your file; it is remembered for next time.</p>
          {required.map(row)}
        </>
      ) : null}
      {optional.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-xs text-muted">Other columns we can read ({optional.length})</summary>
          <div className="mt-2 space-y-2">{optional.map(row)}</div>
        </details>
      ) : null}
    </div>
  );
}
