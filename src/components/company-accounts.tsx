import type { companyAccounts, CompanyAccountView } from "@/lib/company-accounts";
import { PeriodTag } from "@/components/period-tag";
import { dayText, jod, pct } from "@/lib/format";

const money = (v: number | null) => v === null ? "Data missing" : jod(v);

export function CompanyAccounts({ report: r, view, canImport = false, ownerLinks = false, salesThrough = null }: {
  report: Awaited<ReturnType<typeof companyAccounts>>; view: CompanyAccountView; canImport?: boolean;
  /** Link an assigned owner's name to their Sales force page (only for people who may open that page). */
  ownerLinks?: boolean;
  /** Date of the newest invoice. The sales period ends there when it is earlier than the report date. */
  salesThrough?: string | null;
}) {
  const to = salesThrough && salesThrough < r.to ? salesThrough : r.to;
  return <div className="space-y-5">
    <nav aria-label="Account segments" className="flex flex-wrap gap-3 text-sm">
      {([['all', 'All accounts'], ['tender', 'Tender accounts'], ['private', 'Private accounts']] as const).map(([key, label]) =>
        <a key={key} href={`/accounts/${key}${r.search ? `?q=${encodeURIComponent(r.search)}` : ''}`} aria-current={view === key ? 'page' : undefined}
          className={`rounded-md border px-3 py-2 ${view === key ? 'border-brand bg-brand text-brand-ink' : 'border-line'}`}>{label}</a>)}
    </nav>
    <form method="get" className="flex flex-wrap items-end gap-2">
      <div><label htmlFor="account-search" className="block text-sm">Find an account</label>
        <input id="account-search" name="q" type="search" defaultValue={r.search} maxLength={200} placeholder="Name, code, city or owner"
          className="mt-1 rounded-md border border-line px-3 py-2 text-sm" /></div>
      <button className="rounded-md bg-brand px-4 py-2 text-sm text-brand-ink" type="submit">Search</button>
    </form>
    <div>
      <PeriodTag from={r.from} to={to} label="Net sales and gross profit" />
      <p className="mt-1 text-sm text-muted">Sales are after returns. Unpaid and overdue are as of {r.snapshotDate ? dayText(r.snapshotDate) : "no unpaid-invoice snapshot"}.</p>
    </div>
    <p className="text-sm text-muted">Values reflect imported records; complete exports still need reconciliation. Unclassified accounts appear only in All accounts.</p>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {([['Net sales', r.summary.sales], ['Gross profit', r.summary.grossProfit], ['Unpaid balance', r.summary.outstanding], ['Overdue', r.summary.overdue]] as const).map(([label, value]) =>
        <div key={label} className="rounded-lg border border-line bg-surface p-4"><p className="text-xs text-muted">{label}</p><p className="mt-2 text-lg tabular-nums">{money(value)}</p>
          {label === 'Gross profit' && r.summary.costCoverage !== null ? <p className="mt-1 text-[11px] text-muted">Product cost known for {pct(r.summary.costCoverage)} of sales</p> : null}</div>)}
    </div>
    <p className="text-xs text-muted">Totals include all {r.matchedCount} accounts matching this view and search. Gross profit counts only sales lines that carry a product cost, as on the Overview; the share of sales it covers is shown under it.
      Credits reduce unpaid balance; overdue shows positive invoices past their due date, without netting unallocated credits.</p>
    {r.rows.length === 0 ? <p className="rounded-lg border border-line p-5 text-sm">{r.totalAccounts ? "No accounts match this view or search." : "No company customers are loaded yet. Import the customer list to begin."}</p> :
      <div className="overflow-x-auto rounded-lg border border-line"><table className="w-full text-left text-sm">
        <thead><tr>{['Account', 'Segment', 'Net sales', 'Gross profit', 'Unpaid', 'Overdue', 'Last order', 'Review'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
        <tbody>{r.rows.map((a) => <tr key={a.code} className="border-t border-line">
          <td className="px-3 py-2">{a.name}<br /><span className="text-xs text-muted">{a.code}{a.city ? ` · ${a.city}` : ''}{a.owner ? ' · ' : ''}{a.owner && ownerLinks && a.ownerId ? <a href={`/sales-force/${a.ownerId}`} className="underline underline-offset-2">{a.owner}</a> : a.owner}{a.owner && a.importedOwner && a.importedOwner.toLowerCase() !== a.owner.toLowerCase() ? ` (customer file: ${a.importedOwner})` : ''}{!a.active ? ' · Inactive' : ''}</span></td>
          <td className="px-3 py-2">{a.segment ?? 'Unclassified'}</td>
          <td className="px-3 py-2 tabular-nums">{money(a.sales)}</td><td className="px-3 py-2 tabular-nums">{money(a.grossProfit)}</td>
          <td className="px-3 py-2 tabular-nums">{money(a.outstanding)}</td><td className="px-3 py-2 tabular-nums">{money(a.overdue)}</td>
          <td className="px-3 py-2">{a.lastOrder ?? 'No positive order in imports'}</td>
          <td className="px-3 py-2 text-xs text-muted">{[
            !a.segment ? 'Classify account' : null, a.linesWithoutCost ? `${a.linesWithoutCost} sales lines missing cost` : null,
            a.unagedInvoices ? `${a.unagedInvoices} unpaid invoices missing due dates` : null,
            a.overdue !== null && a.overdue > 0 ? 'Follow up overdue invoices' : null,
          ].filter(Boolean).join('; ') || 'No issue from these checks'}</td>
        </tr>)}</tbody>
      </table></div>}
    {r.matchedCount > r.rows.length ? <p className="text-sm text-muted">Showing the first {r.rows.length} of {r.matchedCount}. Narrow the search to see other accounts.</p> : null}
    <p className="text-xs text-muted">Missing files show Data missing. A zero means no amount was found for this account in the imported records, not proof that the export is complete.</p>
    <div className="flex flex-wrap gap-4 text-sm font-semibold text-brand"><a href="/opportunities" className="underline">Reorder estimates and collection actions</a><a href="/weekly" className="underline">Check data readiness</a>{canImport ? <a href="/imports" className="underline">Import files</a> : null}</div>
  </div>;
}
