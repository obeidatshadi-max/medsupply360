import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeading } from "@/components/page-heading";
import { DataTabs } from "@/components/data-tabs";
import { SmartUpload } from "@/components/smart-upload";
import { TemplateDownloads } from "@/components/template-downloads";
import { RecentImports } from "@/components/recent-imports";
import { CHANNEL_INFO } from "@/core/channels";

export const metadata: Metadata = { title: "Tender department channel" };

export default async function TenderChannelPage() {
  const user = await requireUser();
  if (user.guest || user.role !== "owner") {
    return (
      <section className="rounded-lg border border-line bg-surface p-6">
        <h1 className="text-xl font-semibold">Tender department</h1>
        <p className="mt-2 text-sm text-muted">Only the company owner can load a tender list. The tender team records tenders one at a time in the Tenders section.</p>
      </section>
    );
  }
  const kinds = CHANNEL_INFO.tender.kinds;

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow={`${user.companyName} · Data channels`}
        title="Tender department"
        sub="The tender team records each tender, its stages, guarantees and payments in the Tenders section. To load or catch up a whole list at once, upload it here as Excel or CSV. A tender already recorded is updated, but its stage is only ever moved in the Tenders section."
      />
      <DataTabs current="imports" owner history />
      <p className="text-sm">
        <Link href="/imports" className="text-brand underline underline-offset-2">
          All channels
        </Link>
        {" · "}
        <Link href="/tenders" className="text-brand underline underline-offset-2">
          Open Tenders
        </Link>
      </p>
      <section aria-label="Tender results" className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">Award results go in here too</h2>
        <p className="mt-1 max-w-2xl text-xs text-muted">
          Results published by the authorities, and your own bids, load as the file type &ldquo;Tender results&rdquo;. They feed the Price history page and do not change the Alpha ERP figures.{" "}
          <Link href="/tenders/prices" className="underline">How to prepare the file</Link>
          {" · "}
          <a href="/tenders/prices/download?file=template" download className="underline">Empty template</a>
        </p>
      </section>
      <SmartUpload allowed={kinds} noun="your tender list or tender results" />
      <TemplateDownloads kinds={kinds} />
      <RecentImports companyId={user.companyId} kinds={kinds} />
    </div>
  );
}
