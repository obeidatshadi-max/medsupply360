import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeading } from "@/components/page-heading";
import { DataTabs } from "@/components/data-tabs";
import { SmartUpload } from "@/components/smart-upload";
import { TemplateDownloads } from "@/components/template-downloads";
import { RecentImports } from "@/components/recent-imports";
import { CHANNEL_INFO } from "@/core/channels";
import { TenderDataStrip } from "@/components/tender-data-strip";
import { canSeeHistory, canUploadTenders } from "@/core/permissions";
import { companyChannelStatus } from "@/lib/channel-status";

export const metadata: Metadata = { title: "Tender department channel" };

export default async function TenderChannelPage() {
  const user = await requireUser("tender");
  if (user.guest || !canUploadTenders(user.role)) {
    return (
      <section className="rounded-lg border border-line bg-surface p-6">
        <h1 className="text-xl font-semibold">Tender department</h1>
        <p className="mt-2 text-sm text-muted">Only the owner and the tender department can load a tender list. Other people can read tenders in the Tenders section.</p>
      </section>
    );
  }
  const kinds = CHANNEL_INFO.tender.kinds;
  const owner = user.role === "owner";
  const tenderStatus = (await companyChannelStatus(user.companyId)).tender;

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow={`${user.companyName} · Data channels`}
        title="Tender department"
        sub="Upload the tender list and the award results here, as Excel or CSV, as often as you need (daily is fine). You see a preview first and nothing is saved until you confirm. A tender that is already recorded is updated; a blank cell keeps what is recorded. A file never changes a tender's stage: move stages in the Tenders section. The owner can see every upload."
      />
      <DataTabs current="imports" owner={owner} history={canSeeHistory(user.role)} />
      <TenderDataStrip status={tenderStatus} now={new Date()} />
      <p className="text-sm">
        {owner ? (
          <>
            <Link href="/imports" className="text-brand underline underline-offset-2">
              All channels
            </Link>
            {" · "}
          </>
        ) : null}
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
      <SmartUpload companyId={user.companyId} allowed={kinds} noun="your tender list or tender results" />
      <TemplateDownloads kinds={kinds} />
      <RecentImports companyId={user.companyId} kinds={kinds} />
    </div>
  );
}
