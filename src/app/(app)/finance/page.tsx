import type { Metadata } from "next";
import { Glossary } from "@/components/glossary";
import { PageHeading } from "@/components/page-heading";
import { windowEnd } from "@/core/freshness";
import { AGING_BUCKETS } from "@/core/receivables";
import { companyDataSummary } from "@/lib/company-data-summary";
import { requireUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";
import { companyReceivables } from "@/lib/receivables";
import { companyCash } from "@/lib/cash";
import { companySalesByLine } from "@/lib/sales-by-line";
import { daysText, jod, pct, signedPct } from "@/lib/format";

export const metadata: Metadata = { title: "Finance & receivables" };

export default async function FinancePage() {
  const user = await requireUser();
  if (user.guest) {
    return (
      <PageHeading
        eyebrow="Finance & profitability"
        title="Sales, margin and receivables"
        sub="Please sign in with a company account to see this page. It uses the data you imported. Guests see demonstration numbers on the Overview page only."
      />
    );
  }

  const today = businessToday();
  const d = await companyDataSummary(user.companyId);
  const [r, sales, cash] = await Promise.all([
    companyReceivables(user.companyId),
    companySalesByLine(user.companyId, windowEnd(today, d.latestInvoice)),
    companyCash(user.companyId, windowEnd(today, d.latestReceipt)),
  ]);
  const salesSection = (
    <>
      <SalesByLine sales={sales} />
      <CashCollected cash={cash} />
    </>
  );
  if (!r) {
    return (
      <div>
        <PageHeading
          eyebrow={`${user.companyName} · Finance & profitability`}
          title="Sales, margin and receivables"
          sub="You have not imported the unpaid-invoices file yet. Import it (file E05) to see how much customers owe and how late they are."
        />
        {salesSection}
        {user.role === "owner" ? (
          <a href="/imports" className="rounded-[7px] bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-[#125747]">
            Import data
          </a>
        ) : null}
      </div>
    );
  }

  const largest = Math.max(1, ...AGING_BUCKETS.map((b) => r.buckets[b]), r.dueDateMissing.amount);
  const bars: { label: string; amount: number; tone: string }[] = [
    ...AGING_BUCKETS.map((b) => ({ label: b === "Not due" ? "Not yet due" : `${b} days late`, amount: r.buckets[b], tone: b === "Not due" ? "bg-brand" : "bg-gold-soft" })),
    { label: "Due date missing", amount: r.dueDateMissing.amount, tone: "bg-line" },
  ];

  return (
    <div>
      <PageHeading
        eyebrow={`${user.companyName} · Finance & profitability`}
        title="Sales, margin and receivables"
        sub={`Invoices that customers have not paid, on ${r.asOf} (from the unpaid-invoices file, ${r.sourceRows} rows). We count the days after each invoice's due date. An invoice with no due date is shown separately. We do not guess its age.`}
      />
      {salesSection}
      <h2 className="mb-3 mt-8 text-sm font-semibold">Receivables (money customers owe you)</h2>
      <div className="grid grid-cols-2 gap-[10px] md:gap-[14px] min-[1000px]:grid-cols-3">
        {[
          { label: "Total unpaid", value: jod(r.total), note: `On ${r.asOf}` },
          { label: "Overdue", value: jod(r.overdue), note: "Not paid after the due date" },
          { label: "Due date missing", value: jod(r.dueDateMissing.amount), note: `${r.dueDateMissing.invoices} invoice${r.dueDateMissing.invoices === 1 ? "" : "s"}, age not known` },
        ].map((s) => (
          <div key={s.label} className="rounded-[9px] border border-line bg-white p-[15px] md:p-[21px]">
            <p className="text-[11px] text-muted md:text-xs">{s.label}</p>
            <p className="my-2 text-2xl tracking-[-0.9px] md:text-[29px]">{s.value}</p>
            <p className="text-[10px] text-muted md:text-[11px]">{s.note}</p>
          </div>
        ))}
      </div>

      <section aria-label="Aging buckets" className="mt-5 rounded-[9px] border border-line bg-white p-[15px] md:p-[21px]">
        <h2 className="text-sm font-semibold">Unpaid invoices by age (days after the due date)</h2>
        <ul className="mt-3 space-y-2.5">
          {bars.map((b) => (
            <li key={b.label} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-xs md:grid-cols-[140px_1fr_auto]">
              <span>{b.label}</span>
              <span className="h-3 rounded-full bg-[#eef2ef]">
                <span className={`block h-3 rounded-full ${b.tone}`} style={{ width: `${(b.amount / largest) * 100}%` }} />
              </span>
              <span className="tabular-nums">{jod(b.amount)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Customers with most overdue" className="mt-5">
        <h2 className="text-sm font-semibold">Customers with the most late payments</h2>
        {r.topOverdue.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing is overdue.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 text-right font-medium">Overdue amount</th>
                  <th className="px-3 py-2 text-right font-medium">Invoices</th>
                  <th className="px-3 py-2 text-right font-medium">Oldest</th>
                </tr>
              </thead>
              <tbody>
                {r.topOverdue.map((c) => (
                  <tr key={c.customerCode} className="border-t border-line">
                    <td className="px-3 py-2">
                      {c.customerName} <span className="text-xs text-muted">{c.customerCode}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{jod(c.overdue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.invoices}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{daysText(c.oldestDaysOverdue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Glossary page="finance" />
    </div>
  );
}

type Sales = Awaited<ReturnType<typeof companySalesByLine>>;

function SalesByLine({ sales }: { sales: Sales }) {
  const rows = [...sales.lines, sales.total];
  const anyGap = rows.some((x) => typeof x.costCoverage === "number" && x.costCoverage < 1);
  return (
    <section aria-label="Sales and margin by line" className="mb-2">
      <h2 className="text-sm font-semibold">Sales and margin by line, this year so far</h2>
      <p className="mt-1 text-xs text-muted">
        {sales.from} to {sales.to}, compared with {sales.priorFrom} to {sales.priorTo}. Sales without tax, after taking off returned goods. From the sales file.
      </p>
      <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Line</th>
              <th className="px-3 py-2 text-right font-medium">Sales</th>
              <th className="px-3 py-2 text-right font-medium">vs last year</th>
              <th className="px-3 py-2 text-right font-medium">Gross profit</th>
              <th className="px-3 py-2 text-right font-medium">Margin (%)</th>
              <th className="px-3 py-2 text-right font-medium">Cost known (share of sales)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.line} className={`border-t border-line ${x.line === "Total" ? "font-semibold" : ""}`}>
                <td className="px-3 py-2">{x.line}</td>
                <td className="px-3 py-2 text-right tabular-nums">{jod(x.sales)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{signedPct(x.growth)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{typeof x.grossProfit === "number" ? jod(x.grossProfit) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{pct(x.margin, 1)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{pct(x.costCoverage)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-xs text-muted">
        {anyGap
          ? "For some sales the product cost is missing. Gross profit and margin use only the sales that have a cost. We do not treat the missing cost as zero."
          : "A dash (—) means we cannot work out the number yet, for example because there were no sales last year."}
      </p>
    </section>
  );
}

type Cash = Awaited<ReturnType<typeof companyCash>>;

function CashCollected({ cash }: { cash: Cash }) {
  if (!cash) {
    return (
      <section aria-label="Cash collected" className="mt-6">
        <h2 className="text-sm font-semibold">Cash collected, this year so far</h2>
        <p className="mt-1 text-xs text-muted">You have not imported the customer receipts file yet. Import it (file E04).</p>
      </section>
    );
  }
  const largest = Math.max(1, ...cash.months.map((m) => m.amount));
  return (
    <section aria-label="Cash collected" className="mt-6">
      <h2 className="text-sm font-semibold">Cash collected, year to date</h2>
      <p className="mt-1 text-xs text-muted">
        {cash.from} to {cash.to}, compared with {cash.priorFrom} to {cash.priorTo}. From the customer receipts file. Each payment line is counted one time.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-[10px] md:gap-[14px] min-[1000px]:grid-cols-4">
        {[
          { label: "Collected this year", value: jod(cash.ytd), note: `${signedPct(cash.growth)} vs last year (${jod(cash.priorYtd)})` },
          { label: "Last 30 days", value: jod(cash.last30), note: "Up to today" },
          { label: "Not linked to an invoice", value: jod(cash.unlinkedYtd), note: "Money received but not matched to an invoice. It is already in the total above" },
        ].map((x) => (
          <div key={x.label} className="rounded-[9px] border border-line bg-white p-[15px] md:p-[21px]">
            <p className="text-[11px] text-muted md:text-xs">{x.label}</p>
            <p className="my-2 text-2xl tracking-[-0.9px] md:text-[29px]">{x.value}</p>
            <p className="text-[10px] text-muted md:text-[11px]">{x.note}</p>
          </div>
        ))}
      </div>
      <ul className="mt-3 space-y-2 rounded-[9px] border border-line bg-white p-[15px] md:p-[21px]">
        {cash.months.map((m) => (
          <li key={m.month} className="grid grid-cols-[70px_1fr_auto] items-center gap-3 text-xs">
            <span>{m.month}</span>
            <span className="h-3 rounded-full bg-[#eef2ef]">
              <span className="block h-3 rounded-full bg-brand" style={{ width: `${(m.amount / largest) * 100}%` }} />
            </span>
            <span className="tabular-nums">{jod(m.amount)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
