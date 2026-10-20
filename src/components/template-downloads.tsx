"use client";

import { SPECS, type ImportKind } from "@/core/import/specs";
import { hasTemplate, templateCsv } from "@/core/import/template";

/** Starter files for the hand-filled types: the importer's own headings and one made-up example row. */
export function TemplateDownloads({ kinds }: { kinds: readonly ImportKind[] }) {
  const download = (kind: ImportKind) => {
    const url = URL.createObjectURL(new Blob([templateCsv(kind)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `template-${kind.replace("_", "-")}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const withTemplate = kinds.filter(hasTemplate);
  if (withTemplate.length === 0) return null;
  return (
    <section aria-label="Starter files" className="rounded-lg border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold">Starter files</h2>
      <p className="mt-1 text-xs text-muted">
        A starter file has the right column headings and one made-up example row. Open it in Excel, replace the example with your data, and upload it above. You can also upload your own workbook: the tool finds the headings itself.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {withTemplate.map((k) => (
          <button key={k} type="button" onClick={() => download(k)} className="rounded-md border border-brand px-3 py-1.5 text-sm font-semibold text-brand">
            {SPECS[k].title} ↓
          </button>
        ))}
      </div>
    </section>
  );
}
