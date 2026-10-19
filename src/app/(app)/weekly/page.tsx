import type { Metadata } from "next";
import { Glossary } from "@/components/glossary";
import { PageHeading } from "@/components/page-heading";
import { windowEnd } from "@/core/freshness";
import { canSeeHistory } from "@/core/permissions";
import type { Change } from "@/core/weekly";
import { requireUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";
import { companyWeekly } from "@/lib/weekly";
import { dateRange, dayText, jod, signedPct } from "@/lib/format";
import { companyDataReadiness } from "@/lib/data-readiness";
import { companyDataSummary } from "@/lib/company-data-summary";
import { DataReadiness } from "@/components/data-readiness";
import { DataTabs } from "@/components/data-tabs";

export const metadata: Metadata = { title: "Weekly summary" };

const jordanTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Amman", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const sign = (v: number) => (v > 0 ? "+" : v < 0 ? "-" : "");

function Tile({ label, c, money, note, period }: { label: string; c: Change; money: boolean; note: string; period: string }) {
  const fmt = (v: number) => (money ? jod(v) : v.toLocaleString("en-US"));
  return (
    <div className="rounded-[9px] border border-line bg-white p-[15px] md:p-[21px]">
      <p className="text-[11px] text-muted md:text-xs">{label}</p>
      <p className="mt-1 inline-block rounded bg-brand-soft px-1.5 py-0.5 text-[10px] md:text-[11px]">{period}</p>
      <p className="my-2 text-2xl tracking-[-0.9px] md:text-[29px]">{fmt(c.now)}</p>
      <p className="text-[10px] text-muted md:text-[11px]">
        {sign(c.delta)}
        {fmt(Math.abs(c.delta))} ({signedPct(c.pct)}) vs {fmt(c.before)} in the 7 days before
      </p>
      <p className="mt-1 text-[10px] text-muted md:text-[11px]">{note}</p>
    </div>
  );
}

export default async function WeeklyPage() {
  const user = await requireUser();
  if (user.guest) {
    return <PageHeading eyebrow="Alpha ERP data" title="Weekly summary" sub="Please sign in with a company account to see this page. It shows what changed this week in the data you imported." />;
  }
  const today = businessToday();
  const d = await companyDataSummary(user.companyId);
  const [w, readiness] = await Promise.all([
    companyWeekly(user.companyId, today, { sales: windowEnd(today, d.latestInvoice), cash: windowEnd(today, d.latestReceipt) }),
    companyDataReadiness(user.companyId, today),
  ]);
  const { thisFrom, thisTo, prevFrom, prevTo } = w.windows;
  const cash = w.cashWindows;
  // A week that ends before today means the newest import is older than today; say so instead of showing zeros.
  const behind = [thisTo < today ? `sales run to ${dayText(thisTo)}` : null, cash.thisTo < today ? `cash runs to ${dayText(cash.thisTo)}` : null].filter(Boolean).join(" and ");
  const nothing = w.sales.now === 0 && w.sales.before === 0 && w.cash.now === 0 && w.cash.before === 0;

  return (
    <div>
      <PageHeading
        eyebrow={`${user.companyName} · Alpha ERP data`}
        title="Weekly summary"
        sub={`What changed in the last 7 days of imported data (${dateRange(thisFrom, thisTo)}) compared with the 7 days before (${dateRange(prevFrom, prevTo)}). It uses the files you imported. It is only as new as your last import.`}
      />
      <DataTabs current="weekly" owner={user.role === "owner" && !user.guest} history={canSeeHistory(user.role) && !user.guest} />
      {behind ? (
        <p className="mb-4 rounded-lg border border-line bg-white p-3 text-xs text-muted" role="note">
          Your newest imported data is older than today: {behind}. The weeks below end there, not today. Import newer files to see this week.
        </p>
      ) : null}
      {nothing ? (
        <p className="mb-4 rounded-lg border border-line bg-white p-3 text-xs text-muted" role="note">
          There are no sales or payments in these two weeks. Maybe nothing happened, or maybe you have not imported the latest files yet. Check the import dates below before you trust these zeros.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-[10px] md:gap-[14px] min-[1000px]:grid-cols-3">
        <Tile label="Sales" period={dateRange(thisFrom, thisTo)} c={w.sales} money note="Without tax, after taking off returns" />
        <Tile label="Cash collected" period={dateRange(cash.thisFrom, cash.thisTo)} c={w.cash} money note="Money received from customers" />
        <Tile label="Invoices issued" period={dateRange(thisFrom, thisTo)} c={w.orders} money={false} note="Invoices with sales above zero" />
      </div>

      <section aria-label="Overdue receivables" className="mt-6">
        <h2 className="text-sm font-semibold">Overdue receivables</h2>
        {w.overdue ? (
          <p className="mt-1 text-sm">
            {jod(w.overdue.now.now)} overdue as of {w.overdue.nowAsOf}, {w.overdue.now.delta >= 0 ? "up" : "down"} {jod(Math.abs(w.overdue.now.delta))} from {jod(w.overdue.now.before)} as of {w.overdue.beforeAsOf}.
            <span className="text-xs text-muted"> This compares two unpaid-invoice files, not two weeks.</span>
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">To show a change, we need two unpaid-invoice files from two different dates.</p>
        )}
      </section>

      <section aria-label="Top customers this week" className="mt-6">
        <h2 className="text-sm font-semibold">Customers who bought the most, {dateRange(thisFrom, thisTo)}</h2>
        {w.topCustomers.length === 0 ? (
          <p className="mt-1 text-sm text-muted">No sales in the last 7 days.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-white">
            <table className="w-full text-left text-sm">
              <tbody>
                {w.topCustomers.map((c) => (
                  <tr key={c.code} className="border-t border-line first:border-t-0">
                    <td className="px-3 py-2">
                      {c.name} <span className="text-xs text-muted">{c.code}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{jod(c.sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="Imports this week" className="mt-6">
        <h2 className="text-sm font-semibold">Files imported in the last 7 days</h2>
        {w.importsThisWeek.length === 0 ? (
          <p className="mt-1 text-sm text-muted">None. The numbers above may be old.</p>
        ) : (
          <ul className="mt-1 text-sm">
            {w.importsThisWeek.map((i) => (
              <li key={i.kind}>
                {i.kind.replace("_", " ")} <span className="text-xs text-muted">last loaded {jordanTime.format(i.at)} Jordan time</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="mt-6"><DataReadiness report={readiness} canImport={user.role === "owner"} /></div>
      <Glossary page="weekly" />
    </div>
  );
}
