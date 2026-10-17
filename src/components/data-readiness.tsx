import type { companyDataReadiness } from "@/lib/data-readiness";

export function DataReadiness({ report: r, canImport = false }: { report: Awaited<ReturnType<typeof companyDataReadiness>>; canImport?: boolean }) {
  return <section aria-label="Data for predictions" className="rounded-lg border border-line bg-surface p-5">
    <h2 className="text-sm font-semibold">Data for predictions</h2>
    <p className="mt-2 text-sm text-muted">Sales dates in your imports: {r.firstSale ?? "none"} to {r.lastSale ?? "none"}. Checked {r.asOf}.
      These dates show the records present, not confirmed completeness or forecast accuracy.</p>
    {r.missingReorderInputs.length ? <p className="mt-2 text-sm">Still needed for reorder estimates: {r.missingReorderInputs.join(", ")}.</p>
      : <p className="mt-2 text-sm">The three source types for reorder estimates have loaded rows. Check classifications, units and reconciliation before relying on the estimates.</p>}
    <p className="mt-2 text-sm text-muted">{r.unclassifiedCustomers} unclassified customers; {r.productsWithoutUnits} products without a unit.
      Unclassified accounts are excluded from the repeat-consumables pilot. Confirm consistent units and pack sizes.</p>
    <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm">
      <thead><tr><th className="px-3 py-2">Source</th><th className="px-3 py-2">Last loaded (Jordan date)</th><th className="px-3 py-2">Snapshot date</th><th className="px-3 py-2">Last load</th><th className="px-3 py-2">Latest attempt</th></tr></thead>
      <tbody>{r.datasets.map((d) => <tr key={d.kind} className="border-t border-line">
        <td className="px-3 py-2">{d.title}</td><td className="px-3 py-2">{d.lastLoaded?.loaded_on ?? "Never loaded"}</td>
        <td className="px-3 py-2">{d.lastLoaded?.snapshot_date ?? "—"}</td>
        <td className="px-3 py-2">{!d.lastLoaded ? "Missing" : d.lastLoaded.status === "partial" ? `Partial: ${d.lastLoaded.rows_rejected} rows rejected` : "Rows accepted"}</td>
        <td className="px-3 py-2">{!d.latestAttempt ? "None" : d.latestAttempt.status === "rejected" ? `Rejected on ${d.latestAttempt.loaded_on}; ${d.lastLoaded ? "prior data retained" : "nothing loaded"}` : d.latestAttempt.status === "partial" ? "Some rows rejected" : "Passed file checks"}</td>
      </tr>)}</tbody>
    </table></div>
    <p className="mt-3 text-xs text-muted">File checks do not confirm Alpha mappings or accountant totals. A rejected attempt does not refresh the last-loaded date.
      Reconcile historical exports before measuring prediction accuracy. Stockout forecasts also need reservations, purchase orders and supplier lead times.</p>
    {canImport ? <a href="/imports" className="mt-3 inline-block text-sm font-semibold text-brand underline">Import and check files</a> : null}
  </section>;
}
