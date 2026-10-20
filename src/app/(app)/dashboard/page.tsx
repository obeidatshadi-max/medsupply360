import type { Metadata } from "next";
import { FreshnessBanner } from "@/components/freshness-banner";
import { Glossary } from "@/components/glossary";
import { assessFreshness, windowEnd } from "@/core/freshness";
import { PageHeading } from "@/components/page-heading";
import { LineFilter } from "@/components/line-filter";
import { salesForLine } from "@/core/line-filter";
import { currentLine } from "@/lib/line";
import { requireUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";
import { companyCash } from "@/lib/cash";
import { companyDataSummary } from "@/lib/company-data-summary";
import { companyReceivables } from "@/lib/receivables";
import { companySalesByLine } from "@/lib/sales-by-line";
import { companyStockRisk } from "@/lib/stock-risk";
import { dateRange, dayText, jod, jodShort, pct, signedPct } from "@/lib/format";
import { briefAlerts, briefSignals } from "@/lib/owner-brief";
import { OwnerBrief, type BriefCard } from "@/components/owner-brief";
import { GuestOverview } from "@/demo/guest-overview";

export const metadata: Metadata = { title: "Overview" };

const n = (v: number) => v.toLocaleString("en-US");

export default async function DashboardPage() {
  const user = await requireUser();
  // Guests (open access) see the synthetic demonstration dataset; signed-in users see their own company's data.
  if (user.guest) return <GuestOverview />;

  const today = businessToday();
  const line = await currentLine();
  const d = await companyDataSummary(user.companyId);
  // Year-to-date windows end at the newest invoice / receipt, so old imports are not compared against a longer last-year window.
  const [allSales, cash, ar, stock] = await Promise.all([
    companySalesByLine(user.companyId, windowEnd(today, d.latestInvoice)),
    companyCash(user.companyId, windowEnd(today, d.latestReceipt)),
    companyReceivables(user.companyId),
    companyStockRisk(user.companyId, line),
  ]);
  const sales = salesForLine(allSales, line);
  const empty = d.products + d.customers + d.invoices + d.receipts + d.stockTransactions + d.installedUnits === 0 && !d.openInvoices && !d.stock;
  const t = sales.total;
  const freshness = assessFreshness({
    today,
    latestInvoice: d.latestInvoice,
    latestReceipt: d.latestReceipt,
    openInvoicesAsOf: d.openInvoices?.asOf ?? null,
    stockAsOf: d.stock?.asOf ?? null,
  });
  const sig = briefSignals({
    salesGrowth: d.invoices > 0 ? t.growth : null,
    cashGrowth: cash ? cash.growth : null,
    receivables: ar ? { overdue: ar.overdue, total: ar.total } : null,
    stock: stock
      ? {
          slow: stock.slowValue,
          total: stock.stockValue,
          expiryLoss: stock.expiryLossEstimate,
        }
      : null,
  });
  const alerts = briefAlerts(sig, {
    overdue: ar ? jodShort(ar.overdue) : undefined,
    slow: stock ? jodShort(stock.slowValue) : undefined,
    expiry: stock ? jodShort(stock.expiryLossEstimate) : undefined,
  });
  const cards: BriefCard[] = [
    {
      title: "Sales",
      status: sig.sales,
      value: d.invoices > 0 ? jodShort(t.sales) : "—",
      verdict: d.invoices > 0 ? "Net sales so far this year" : "Import the sales file to see this",
      href: "/finance",
      when: { label: "Period", text: `${dateRange(sales.from, sales.to)} · year to date` },
      terms: ["Net sales", "Year to date"],
      visual: { kind: "trend", growth: d.invoices > 0 ? t.growth : null, against: dateRange(sales.priorFrom, sales.priorTo) },
    },
    {
      title: "Cash collected",
      status: sig.cash,
      value: cash ? jodShort(cash.ytd) : "—",
      verdict: cash ? "Money received so far this year" : "Import the receipts file to see this",
      href: "/finance",
      when: { label: "Period", text: `${dateRange(cash?.from ?? sales.from, cash?.to ?? sales.to)} · year to date` },
      terms: ["Cash collected"],
      visual: { kind: "trend", growth: cash ? cash.growth : null, against: cash ? dateRange(cash.priorFrom, cash.priorTo) : undefined },
    },
    {
      title: "Overdue payments",
      status: sig.overdue,
      value: ar ? jodShort(ar.overdue) : "—",
      verdict: ar ? `Customers owe ${jodShort(ar.total)} in total` : "Import the unpaid-invoices file to see this",
      href: "/finance",
      when: ar ? { label: "Checked", text: `${dayText(ar.asOf)} (date of the unpaid-invoices file)` } : undefined,
      terms: ["Overdue", "Due date"],
      visual: {
        kind: "share",
        share: sig.overdueShare,
        of: "of unpaid invoices is overdue",
      },
    },
    {
      title: "Stock at risk",
      status: sig.stock,
      value: stock ? jodShort(stock.slowValue) : "—",
      verdict: stock
        ? `Slow or unused. Another ${jodShort(stock.expiryLossEstimate)} may expire unsold (estimate), out of ${jodShort(stock.stockValue)} owned`
        : "Import the stock file to see this",
      href: "/inventory",
      when: stock ? { label: "Checked", text: `${dayText(stock.asOf)} (date of the stock file)` } : undefined,
      terms: ["Slow stock", "Expiry loss"],
      visual: {
        kind: "share",
        share: sig.slowShare,
        of: "of your stock is slow or unused",
      },
    },
  ];
  const headline: {
    label: string;
    value: string;
    note: string;
    href: string;
  }[] = [
    {
      label: `Net sales, ${dateRange(sales.from, sales.to)}`,
      value: d.invoices > 0 ? jod(t.sales) : "—",
      note: d.invoices > 0 ? `${signedPct(t.growth)} compared with ${dateRange(sales.priorFrom, sales.priorTo)}` : "No sales imported yet",
      href: "/finance",
    },
    {
      label: `Gross margin, ${dateRange(sales.from, sales.to)}`,
      value: pct(t.margin, 1),
      note: typeof t.costCoverage === "number" ? `Product cost is known for ${pct(t.costCoverage)} of sales` : "Needs sales that include product cost",
      href: "/finance",
    },
    {
      label: cash ? `Cash collected, ${dateRange(cash.from, cash.to)}` : "Cash collected",
      value: cash ? jod(cash.ytd) : "—",
      note: cash ? `${signedPct(cash.growth)} compared with ${dateRange(cash.priorFrom, cash.priorTo)}` : "No receipts imported yet",
      href: "/finance",
    },
    {
      label: "Overdue payments from customers",
      value: ar ? jod(ar.overdue) : "—",
      note: ar
        ? `of ${jod(ar.total)} unpaid, on ${ar.asOf}${ar.dueDateMissing.invoices > 0 ? `; ${ar.dueDateMissing.invoices} invoice${ar.dueDateMissing.invoices === 1 ? "" : "s"} have no due date` : ""}`
        : "No unpaid-invoices file yet",
      href: "/finance",
    },
    {
      label: "Slow or unused stock",
      value: stock ? jod(stock.slowValue) : "—",
      note: stock ? `of ${jod(stock.stockValue)} stock that you own, on ${stock.asOf}` : "No stock file yet",
      href: "/inventory",
    },
    {
      label: "Possible loss from expiry (estimate)",
      value: stock ? jod(stock.expiryLossEstimate) : "—",
      note: stock ? `${jod(stock.expiredValue)} already expired. Estimate. It can include the same products as slow stock` : "No stock file yet",
      href: "/inventory",
    },
  ];
  const stats: { label: string; value: string; note: string }[] = [
    { label: "Products", value: n(d.products), note: "From the product list" },
    {
      label: "Customers",
      value: n(d.customers),
      note: "From the customer list",
    },
    {
      label: "Invoices",
      value: n(d.invoices),
      note: `${n(d.salesLines)} sales and return lines`,
    },
    { label: "Receipts", value: n(d.receipts), note: "Cash allocation rows" },
    {
      label: "Unpaid invoices",
      value: d.openInvoices ? n(d.openInvoices.rows) : "—",
      note: d.openInvoices ? `Snapshot as of ${d.openInvoices.asOf}` : "Not imported yet",
    },
    {
      label: "Stock rows",
      value: d.stock ? n(d.stock.rows) : "—",
      note: d.stock ? `Snapshot as of ${d.stock.asOf}` : "Not imported yet",
    },
    {
      label: "Stock transactions",
      value: n(d.stockTransactions),
      note: "Issues, returns, transfers",
    },
    {
      label: "Installed equipment",
      value: n(d.installedUnits),
      note: "Units at customers",
    },
  ];

  return (
    <div>
      <PageHeading
        eyebrow={`${user.companyName} · Owner overview`}
        title="Owner overview"
        sub={
          empty
            ? "You have not imported any data yet. First import the Alpha ERP files: products, customers, sales, receipts, unpaid invoices and stock."
            : "The four things an owner should check first. Click a card for detail. A dash (—) means a file is missing."
        }
      />
      {empty ? null : <LineFilter current={line} note="Sales, margin and stock follow the line you choose. Cash collected and unpaid invoices are not split by line." />}
      {empty ? null : <FreshnessBanner freshness={freshness} canImport={user.role === "owner"} />}
      {empty ? null : <OwnerBrief cards={cards} alerts={alerts} />}
      <details className="group rounded-[10px] border border-line bg-white p-4 md:p-5">
        <summary className="cursor-pointer text-sm font-semibold">More figures and the data you have loaded</summary>
        <div className="mt-4 grid grid-cols-2 gap-[10px] md:gap-[14px] min-[1000px]:grid-cols-3">
          {headline.map((s) => (
            <a key={s.label} href={s.href} className="rounded-[9px] border border-line bg-white p-[15px] hover:border-brand md:p-[21px]">
              <p className="text-[11px] text-muted md:text-xs">{s.label}</p>
              <p className="my-2 text-2xl tracking-[-0.9px] md:text-[29px]">{s.value}</p>
              <p className="text-[10px] text-muted md:text-[11px]">{s.note}</p>
            </a>
          ))}
        </div>
        <h2 className="mb-3 mt-6 text-sm font-semibold">Data you have loaded</h2>
        <div className="grid grid-cols-2 gap-[10px] md:gap-[14px] min-[1000px]:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} data-figure className="rounded-[9px] border border-line bg-white p-[15px] md:p-[21px]">
              <p className="text-[11px] text-muted md:text-xs">{s.label}</p>
              <p className="my-2 text-2xl tracking-[-0.9px] md:text-[29px]">{s.value}</p>
              <p className="text-[10px] text-muted md:text-[11px]">{s.note}</p>
            </div>
          ))}
        </div>
      </details>
      <div className="mt-5 flex flex-wrap gap-3">
        {user.role === "owner" ? (
          <a href="/imports" className="rounded-[7px] bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-[#125747]">
            Import data
          </a>
        ) : null}
        <a href="/sample" className="rounded-[7px] border border-line bg-white px-4 py-2 text-sm hover:border-brand hover:bg-[#f0f6f2]">
          Explore with sample data
        </a>
      </div>
      <Glossary page="overview" />
    </div>
  );
}
