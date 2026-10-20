"use client";

import { useState } from "react";
import { collectExport, exportFileName, toCsv } from "@/core/export-csv";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/**
 * "Export ↓" in the top bar: downloads the figures, tables and cards of the screen being read as a CSV file. It exports
 * what is on screen, so the business-line filter and the search apply. `name` is the screen's name, used in the file name.
 */
export function ExportButton({ name }: { name: string }) {
  const [note, setNote] = useState<string | null>(null);

  const run = () => {
    const root = document.querySelector("main");
    const rows = root ? collectExport(root) : [];
    if (rows.length === 0) {
      setNote("Nothing to export on this screen");
    } else {
      const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = exportFileName(name, today());
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNote(`Exported ${rows.filter((r) => r.length > 1).length} rows`);
    }
    setTimeout(() => setNote(null), 3500);
  };

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={run} className="rounded-[7px] border border-line bg-white px-3 py-1.5 text-sm hover:border-brand hover:bg-[#f0f6f2]">
        Export ↓
      </button>
      {note ? (
        <span role="status" className="hidden whitespace-nowrap text-xs text-muted md:inline">
          {note}
        </span>
      ) : null}
    </div>
  );
}
