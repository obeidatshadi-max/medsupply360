import { DEMO_AS_OF, DEMO_PERIOD } from "./dataset";
import { VIEWS, privateInsights, segmentComparison, tenderBoard, viewRows, viewSummary, type AccountRow, type View } from "./accounts";
import { daysText, jod, jodShort, pct, signedPct } from "@/lib/format";

const card = "rounded-lg border border-line bg-surface p-5";
const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted";
const td = "px-3 py-2.5 text-sm align-top";

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className={card}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-2 text-2xl font-medium tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}

function Panel({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className={card}>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mb-3 mt-0.5 text-xs text-muted">{sub}</p>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function Head({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr>
        {cols.map((h) => (
          <th key={h} className={th}>
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );
}

const STATUS_STYLE = {
  "At risk": "bg-bad-soft text-bad",
  Watch: "bg-[#f6efdf] text-[#8c6a2e]",
  Healthy: "bg-brand-soft text-brand",
} as const;

function StatusBadge({ row }: { row: AccountRow }) {
  return (
    <div>
      <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[row.status.level]}`}>{row.status.level}</span>
      {row.status.reasons.map((r) => (
        <span key={r} className="mt-1 block max-w-[16rem] whitespace-normal text-[11px] text-muted">
          {r}
        </span>
      ))}
    </div>
  );
}

function AccountsTable({ rows, view }: { rows: AccountRow[]; view: View }) {
  const total = viewSummary(view);
  return (
    <table className="w-full whitespace-nowrap">
      <Head cols={["Account", "Status", "Sales YTD", "Gross profit YTD", "Margin", "vs last year", "vs target", "Outstanding", "Overdue (oldest)", "Credit used", "Last order"]} />
      <tbody>
        {rows.map((r) => (
          <tr key={r.seed.id} className="border-t border-line">
            <td className={td}>
              <span className="font-medium">{r.seed.name}</span>
              <span className="block text-[11px] text-muted">
                {r.seed.segment} · {r.seed.type} · {r.seed.city} · {r.seed.manager}
              </span>
            </td>
            <td className={td}>
              <StatusBadge row={r} />
            </td>
            <td className={td}>{jodShort(r.sales)}</td>
            <td className={td}>
              {jodShort(r.grossProfit)}
              <span className="block text-[11px] text-muted">{pct(r.gpShare, 1)} of company</span>
            </td>
            <td className={td}>{pct(r.margin, 1)}</td>
            <td className={td}>{signedPct(r.salesYoy)}</td>
            <td className={td}>{pct(r.attainment)}</td>
            <td className={td}>{jodShort(r.outstanding)}</td>
            <td className={td}>{r.overdue > 0 ? `${jodShort(r.overdue)} (${daysText(r.maxOverdueDays)})` : "—"}</td>
            <td className={td}>{pct(r.creditUse)}</td>
            <td className={td}>{daysText(r.daysSinceLastOrder)} ago</td>
          </tr>
        ))}
        <tr className="border-t border-line font-medium">
          <td className={td}>{rows.length} accounts</td>
          <td className={td} />
          <td className={td}>{jodShort(total.sales)}</td>
          <td className={td}>{jodShort(total.grossProfit)}</td>
          <td className={td}>{pct(total.margin, 1)}</td>
          <td className={td}>{signedPct(total.salesYoy)}</td>
          <td className={td}>{pct(total.attainment)}</td>
          <td className={td}>{jodShort(total.outstanding)}</td>
          <td className={td}>{jodShort(total.overdue)}</td>
          <td className={td} />
          <td className={td} />
        </tr>
      </tbody>
    </table>
  );
}

function SegmentComparison() {
  const c = segmentComparison();
  const col = (s: ReturnType<typeof viewSummary>, total: ReturnType<typeof viewSummary>) => [
    String(s.accounts),
    `${jodShort(s.sales)} (${pct(total.sales > 0 ? s.sales / total.sales : "x")})`,
    jodShort(s.grossProfit),
    pct(s.margin, 1),
    pct(s.gpShare, 1),
    signedPct(s.salesYoy),
    signedPct(s.grossProfitYoy),
    pct(s.attainment),
    jodShort(s.outstanding),
    `${jodShort(s.overdue)} (${pct(s.overdueShare)} of balance)`,
    daysText(s.dso),
    `${s.atRisk} at risk · ${s.watch} watch · ${s.healthy} healthy`,
  ];
  const labels = [
    "Accounts",
    "Sales YTD (share)",
    "Gross profit YTD",
    "Gross margin",
    "Share of company gross profit",
    "Sales vs last year",
    "Gross profit vs last year",
    "Sales vs target",
    "Outstanding receivables",
    "Overdue",
    "Days sales outstanding",
    "Account health",
  ];
  const t = col(c.tender, c.all);
  const p = col(c.private, c.all);
  const a = col(c.all, c.all);
  return (
    <table className="w-full whitespace-nowrap">
      <Head cols={["Measure", "Tender accounts", "Private accounts", "Total accounts"]} />
      <tbody>
        {labels.map((l, i) => (
          <tr key={l} className="border-t border-line">
            <td className={`${td} text-muted`}>{l}</td>
            <td className={td}>{t[i]}</td>
            <td className={td}>{p[i]}</td>
            <td className={`${td} font-medium`}>{a[i]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TenderSection() {
  const b = tenderBoard();
  const h = b.history;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Pipeline" value={jodShort(b.pipeline.value)} note={`${b.pipeline.count} tenders preparing or submitted · planned margin ${pct(b.pipeline.plannedMargin, 1)}`} />
        <Tile label="Delivering" value={jodShort(b.delivering.backlogToDeliver)} note={`Backlog still to deliver on ${b.delivering.count} awarded contract`} />
        <Tile label="Collecting" value={jodShort(b.collecting.invoicedNotCollected)} note={`Invoiced, not yet collected · ${b.deliveredNotInvoiced > 0 ? `${jodShort(b.deliveredNotInvoiced)} delivered, not invoiced` : "nothing delivered but uninvoiced"}`} />
      </div>
      <Panel title="Tender register" sub="Value is not sales until the contract is booked. Planned margin is an estimate of profit after costs. Check how costs are shared.">
        <table className="w-full whitespace-nowrap">
          <Head cols={["Tender", "Stage", "Value", "Planned margin", "Next date", "Delivered", "Invoiced", "Collected", "Guarantee", "Attention"]} />
          <tbody>
            {b.rows.map((t) => (
              <tr key={t.id} className="border-t border-line">
                <td className={td}>
                  <span className="font-medium">{t.name}</span>
                  <span className="block text-[11px] text-muted">
                    {t.id} · {t.account} · {t.line}
                  </span>
                </td>
                <td className={td}>{t.stage}</td>
                <td className={td}>{jod(t.value)}</td>
                <td className={td}>{t.margin}%</td>
                <td className={td}>
                  {t.due}
                  <span className="block text-[11px] text-muted">{t.daysToDeadline >= 0 ? `in ${t.daysToDeadline} days` : `${-t.daysToDeadline} days ago`}</span>
                </td>
                <td className={td}>{t.deliveredPct}%</td>
                <td className={td}>{jod(t.invoiced)}</td>
                <td className={td}>{jod(t.collected)}</td>
                <td className={td}>
                  {t.guarantee.kind} {jod(t.guarantee.amount)}
                  <span className="block text-[11px] text-muted">expires {t.guarantee.expires} ({t.guarantee.daysToExpiry} days)</span>
                </td>
                <td className={td}>{t.risk}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel title={`Tender results, ${DEMO_PERIOD}`} sub="Win rate = won ÷ (won + lost). Tenders still waiting for a decision are not counted either way.">
        <table className="w-full whitespace-nowrap">
          <Head cols={["Submitted", "Won", "Lost", "Pending", "Win rate", "Value won", "Average won tender"]} />
          <tbody>
            <tr className="border-t border-line">
              <td className={td}>{h.submitted}</td>
              <td className={td}>{h.won}</td>
              <td className={td}>{h.lost}</td>
              <td className={td}>{h.pending}</td>
              <td className={`${td} font-medium`}>{pct(h.winRate, 1)}</td>
              <td className={td}>{jodShort(h.valueWon)}</td>
              <td className={td}>{typeof h.avgWonValue === "number" ? jodShort(h.avgWonValue) : "—"}</td>
            </tr>
          </tbody>
        </table>
      </Panel>
    </>
  );
}

/** Accounts screen: total accounts with a tender view and a private view. Synthetic data, every figure derived via the core. */
export function AccountsScreen({ view, basePath, banner }: { view: View; basePath: string; banner?: string }) {
  const rows = viewRows(view);
  const s = viewSummary(view);
  const pi = privateInsights();
  const title = VIEWS.find((v) => v.key === view)!.label;
  const sub =
    view === "tender"
      ? "Public-sector bodies that buy through formal tenders: ministries, university and government hospitals, military medical services."
      : view === "private"
        ? "Private hospitals, surgical centres and clinics that buy by quotation or purchase order."
        : "Every account, with tender (public-sector) and private accounts side by side.";

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-brand">Sales and accounts · {DEMO_PERIOD}</p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">{sub}</p>
        <p className="mt-1 text-xs text-muted">{banner ?? `Made-up demonstration data, on ${DEMO_AS_OF}. These are not real company figures.`}</p>
      </div>

      <nav aria-label="Account views" className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <a
            key={v.key}
            href={`${basePath}/${v.key}`}
            aria-current={v.key === view ? "page" : undefined}
            className={`rounded-md border px-3 py-1.5 text-sm ${v.key === view ? "border-ink bg-ink text-white" : "border-line bg-surface"}`}
          >
            {v.label}
          </a>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Accounts" value={String(s.accounts)} note={`${s.atRisk} at risk · ${s.watch} watch · ${s.healthy} healthy`} />
        <Tile label={`Sales, ${DEMO_PERIOD}`} value={jodShort(s.sales)} note={`${signedPct(s.salesYoy)} vs last year · ${pct(s.attainment)} of target`} />
        <Tile label={`Gross profit, ${DEMO_PERIOD}`} value={jodShort(s.grossProfit)} note={`${pct(s.margin, 1)} margin · ${pct(s.gpShare, 1)} of company · ${signedPct(s.grossProfitYoy)} vs last year`} />
        <Tile label="Unpaid invoices" value={jodShort(s.outstanding)} note={`${jodShort(s.overdue)} overdue · ${daysText(s.dso)} sales outstanding`} />
      </div>

      {view === "all" ? (
        <Panel title="Tender accounts versus private accounts" sub="The two customer types add up to the company total. Margin and payment behaviour are very different, so they are managed separately.">
          <SegmentComparison />
        </Panel>
      ) : null}

      {view === "tender" ? <TenderSection /> : null}

      {view === "private" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Tile label="Repeat consumables" value={pct(pi.capture)} note={`Purchases vs estimated demand on ${pi.unitCount} installed units · gap ${jod(pi.monthlyGap)} a month to look into`} />
          <Tile label="Service contracts" value={`${pi.unitsCovered} of ${pi.unitCount}`} note="Installed units with a contract in force (renewal window counts as covered)" />
          <Tile label="Order rhythm" value={`${pi.ordersPerMonth.toFixed(1)} a month`} note={`${pi.quiet} account${pi.quiet === 1 ? "" : "s"} with no order for over 45 days`} />
        </div>
      ) : null}

      <Panel title={view === "all" ? "All accounts" : `${title}`} sub="Ranked by gross profit. Status shows why an account needs attention.">
        <AccountsTable rows={rows} view={view} />
      </Panel>

      <div className="space-y-1 text-xs text-muted">
        <p>
          Gross profit = sales without tax minus the cost of goods sold. It does not include freight, installation, warranty, overhead or finance costs. Days sales outstanding (DSO) = unpaid
          amount ÷ sales × days in the period. Old unpaid invoices make it higher, so use it to compare accounts, not as an audited figure.
        </p>
        <p>
          Status: <strong>At risk</strong> when an invoice is more than 90 days late, or more than 90% of the credit limit is used. <strong>Watch</strong> for any late balance, sales below 85% of
          target or 10% below last year, repeat purchases below 70% of the estimated need, a private account silent for 45 days, or a tender deadline within 14 days.
        </p>
      </div>
    </div>
  );
}
