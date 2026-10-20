import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeading } from "@/components/page-heading";
import { DataTabs } from "@/components/data-tabs";
import { SmartUpload } from "@/components/smart-upload";
import { RecentImports } from "@/components/recent-imports";
import { CHANNEL_INFO } from "@/core/channels";

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

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow={`${user.companyName} · Data channels`}
        title="Manual entry"
        sub="Data that Alpha does not hold. Upload a workbook or CSV and the tool reads each tab, recognises what it is, and shows you the result to confirm. Sales people and their targets are kept on the Sales force page."
      />
      <DataTabs current="imports" owner history />
      <p className="text-sm">
        <a href="/imports" className="text-brand underline underline-offset-2">
          All channels
        </a>
        {" · "}
        <a href="/sales-force" className="text-brand underline underline-offset-2">
          Sales force and targets
        </a>
      </p>
      <SmartUpload allowed={kinds} noun="your installed-equipment list" />
      <RecentImports companyId={user.companyId} kinds={kinds} />
    </div>
  );
}
