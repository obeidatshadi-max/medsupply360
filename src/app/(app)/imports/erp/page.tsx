import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeading } from "@/components/page-heading";
import { DataTabs } from "@/components/data-tabs";
import { SmartUpload } from "@/components/smart-upload";
import { RecentImports } from "@/components/recent-imports";
import { CHANNEL_INFO } from "@/core/channels";

export const metadata: Metadata = { title: "ERP system channel" };

export default async function ErpChannelPage() {
  const user = await requireUser();
  if (user.guest || user.role !== "owner") {
    return (
      <section className="rounded-lg border border-line bg-surface p-6">
        <h1 className="text-xl font-semibold">ERP system</h1>
        <p className="mt-2 text-sm text-muted">Only the company owner can import ERP files.</p>
      </section>
    );
  }
  const kinds = CHANNEL_INFO.erp.kinds;

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow={`${user.companyName} · Data channels`}
        title="ERP system"
        sub="Upload the Alpha exports from your accountant, as Excel or CSV. You can upload one file or all of them at once. The app finds the type of each file from its column headings and loads them in the right order: products and customers first, then sales, receipts, unpaid invoices and stock. The preview shows totals. Compare them with Alpha."
      />
      <DataTabs current="imports" owner history />
      <p className="text-sm">
        <a href="/imports" className="text-brand underline underline-offset-2">
          All channels
        </a>
      </p>
      <SmartUpload companyId={user.companyId} allowed={kinds} noun="the Alpha exports" />
      <RecentImports companyId={user.companyId} kinds={kinds} />
    </div>
  );
}
