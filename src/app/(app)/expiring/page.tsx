import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { CustomerLink } from "@/components/customer-link";
import { ServiceDataStrip } from "@/components/service-data-strip";
import { BUCKETS, BUCKET_LABEL, KIND_LABEL, buildExpiryList, daysText, summarizeExpiry, type ExpiryKind } from "@/core/expiry-alerts";
import { canAccess, canUploadEquipment } from "@/core/permissions";
import { requireUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";
import { dayText } from "@/lib/format";
import { companyInstalledUnits } from "@/lib/installed-base";
import { lastServiceUpdate } from "@/lib/service-data";

export const metadata: Metadata = { title: "Expiry alerts" };

const chip = (active: boolean) => `rounded-full border px-3 py-1 text-xs ${active ? "border-brand bg-brand text-brand-ink" : "border-line bg-white hover:border-brand"}`;

export default async function ExpiryAlertsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("service");
  if (user.guest) return <PageHeading eyebrow="Expiry alerts" title="Expiry alerts" sub="Please sign in with a company account to see this page." />;
  const sp = await searchParams;
  const raw = typeof sp.kind === "string" ? sp.kind : "";
  const kind: ExpiryKind | "" = raw === "contract" || raw === "warranty" ? raw : "";
  const today = businessToday();
  const [units, last] = await Promise.all([companyInstalledUnits(user.companyId), lastServiceUpdate(user.companyId)]);
  const all = buildExpiryList(units, today);
  const summary = summarizeExpiry(all, units);
  const items = kind ? all.filter((i) => i.kind === kind) : all;
  const plain = !canAccess(user.role, "business");
  const link = (k: string) => (k ? `/expiring?kind=${k}` : "/expiring");

  return (
    <div className="space-y-5">
      <PageHeading
        eyebrow={`${user.companyName} · Expiry alerts`}
        title="Expiry alerts"
        sub={`Service contracts and warranties that end within 90 days, or ended in the last 30, on ${dayText(today)}. Each one is a call to make: renew the contract, sell one, or tell the customer the warranty is ending. Only dates someone recorded are used.`}
      />
      <ServiceDataStrip lastUpdate={last.lastUpdate} by={last.by} now={new Date()} uploadHref={canUploadEquipment(user.role) ? (user.role === "owner" ? "/imports/manual" : "/imports/equipment") : null} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {BUCKETS.map((b) => (
          <div key={b} data-figure className="rounded-lg border border-line bg-white p-4">
            <p className="text-[11px] text-muted md:text-xs">{BUCKET_LABEL[b]}</p>
            <p className={`my-1 text-2xl tabular-nums ${b === "ended" && summary.byBucket[b] > 0 ? "text-bad" : ""}`}>{summary.byBucket[b]}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
        <Link href={link("")} className={chip(kind === "")} aria-current={kind === "" ? "true" : undefined}>All ({summary.total})</Link>
        <Link href={link("contract")} className={chip(kind === "contract")} aria-current={kind === "contract" ? "true" : undefined}>Service contracts ({summary.byKind.contract})</Link>
        <Link href={link("warranty")} className={chip(kind === "warranty")} aria-current={kind === "warranty" ? "true" : undefined}>Warranties ({summary.byKind.warranty})</Link>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-line bg-white p-4 text-sm text-muted">
          {summary.total === 0 && units.every((u) => !u.contractEnd && !u.warrantyEnd)
            ? "No machine has a contract or warranty end date yet. Add them in the equipment file or in the machine details form, and this list fills in by itself."
            : "Nothing ends within the next 90 days, and nothing ended in the last 30."}
        </p>
      ) : (
        BUCKETS.map((b) => {
          const rows = items.filter((i) => i.bucket === b);
          if (rows.length === 0) return null;
          return (
            <section key={b} aria-label={BUCKET_LABEL[b]}>
              <h2 className="mb-2 text-sm font-semibold">
                {BUCKET_LABEL[b]} <span className="font-normal text-muted">({rows.length})</span>
              </h2>
              <div className="overflow-x-auto rounded-lg border border-line bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">Machine</th>
                      <th className="px-3 py-2 font-medium">Customer</th>
                      <th className="px-3 py-2 font-medium">What ends</th>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">When</th>
                      <th className="px-3 py-2 font-medium">Contact to call</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={`${r.unitCode}-${r.kind}`} className="border-t border-line align-top">
                        <td className="px-3 py-2">
                          <Link href={`/installed-base/${encodeURIComponent(r.unitCode)}`} className="underline decoration-line underline-offset-2 hover:decoration-brand">{r.unitName}</Link>
                        </td>
                        <td className="px-3 py-2"><CustomerLink code={r.customerCode} name={r.customerName} plain={plain} /></td>
                        <td className="px-3 py-2">{KIND_LABEL[r.kind]}</td>
                        <td className="px-3 py-2 tabular-nums">{dayText(r.date)}</td>
                        <td className="px-3 py-2">{daysText(r.days)}</td>
                        <td className="px-3 py-2">{r.contact ?? <span className="text-muted">Not recorded</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}

      <p className="rounded-lg border border-line bg-white p-3 text-xs text-muted" role="note">
        {summary.machinesWithoutDates > 0
          ? `${summary.machinesWithoutDates} machine${summary.machinesWithoutDates === 1 ? " has" : "s have"} no contract or warranty end date, so nothing can be said about ${summary.machinesWithoutDates === 1 ? "it" : "them"}. `
          : ""}
        A contract end date also sets the machine&apos;s service status: ended means no contract, within 60 days means expiring.
      </p>
    </div>
  );
}
