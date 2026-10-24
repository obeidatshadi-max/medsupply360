import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeading } from "@/components/page-heading";
import { DataTabs } from "@/components/data-tabs";
import { SmartUpload } from "@/components/smart-upload";
import { TemplateDownloads } from "@/components/template-downloads";
import { RecentImports } from "@/components/recent-imports";
import { MachineDetailsForm } from "@/components/machine-details-form";
import { SupportEntry } from "@/components/support-entry";
import { CHANNEL_INFO } from "@/core/channels";
import { getDb } from "@/db/client";
import { businessToday } from "@/lib/business-date";
import { companyInstalledUnits } from "@/lib/installed-base";
import { listIndicators } from "@/server/services/support-indicators";

export const metadata: Metadata = { title: "Manual entry channel" };

export default async function ManualChannelPage() {
  const user = await requireUser();
  if (user.guest || user.role !== "owner") {
    return (
      <section className="rounded-lg border border-line bg-surface p-6">
        <h1 className="text-xl font-semibold">Manual entry</h1>
        <p className="mt-2 text-sm text-muted">Only the company owner can load this data.</p>
      </section>
    );
  }
  const kinds = CHANNEL_INFO.manual.kinds;
  const [indicators, units] = await Promise.all([listIndicators(getDb(), user.companyId), companyInstalledUnits(user.companyId)]);
  // Two identical machines at one customer are told apart by a number.
  const seen = new Map<string, number>();
  const totals = new Map<string, number>();
  for (const u of units) totals.set(`${u.customerCode}|${u.name}`, (totals.get(`${u.customerCode}|${u.name}`) ?? 0) + 1);
  const machines = units.map((u) => {
    const key = `${u.customerCode}|${u.name}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return { code: u.code, label: `${u.customerName} · ${u.name}${(totals.get(key) ?? 1) > 1 ? ` #${n}` : ""}${u.source === "manual" ? " (details added)" : ""}` };
  });

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow={`${user.companyName} · Data channels`}
        title="Manual entry"
        sub="Data that Alpha does not hold: details of the machines (their sales are already in the ERP files), the sales force with their targets and suppliers, and the support-function indicators. Upload a workbook or CSV and the tool reads each tab, recognises what it is, and shows you the result to confirm. A person already on the Sales force page is updated by name; a blank cell never erases what is recorded."
      />
      <DataTabs current="imports" owner history />
      <p className="text-sm">
        <a href="/imports" className="text-brand underline underline-offset-2">
          All channels
        </a>
        {" · "}
        <Link href="/sales-force" className="text-brand underline underline-offset-2">
          Sales force and targets
        </Link>
      </p>
      <SmartUpload allowed={kinds} noun="your installed-equipment list or your sales force and targets" />
      <TemplateDownloads kinds={kinds} />
      <MachineDetailsForm machines={machines} />
      <RecentImports companyId={user.companyId} kinds={kinds} />
      <SupportEntry indicators={indicators} today={businessToday()} />
    </div>
  );
}
