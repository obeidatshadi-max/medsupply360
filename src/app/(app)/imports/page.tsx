import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeading } from "@/components/page-heading";
import { DataTabs } from "@/components/data-tabs";
import { ChannelCard } from "@/components/channel-card";
import { CHANNELS } from "@/core/channels";
import { companyChannelStatus } from "@/lib/channel-status";

export const metadata: Metadata = { title: "Data channels" };

export default async function ImportsPage() {
  const user = await requireUser();
  if (user.guest || user.role !== "owner") {
    return (
      <section className="rounded-lg border border-line bg-surface p-6">
        <h1 className="text-xl font-semibold">Data channels</h1>
        <p className="mt-2 text-sm text-muted">Only the company owner can load data.</p>
      </section>
    );
  }
  const status = await companyChannelStatus(user.companyId);
  const now = new Date();

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow={`${user.companyName} · Data`}
        title="Data channels"
        sub="Data reaches the app by three channels, each with its own source. Open a channel to load files. Whatever you upload is read, recognised and previewed first, and nothing is saved until you confirm."
      />
      <DataTabs current="imports" owner history />
      <div className="grid gap-4 md:grid-cols-3">
        {CHANNELS.map((c) => (
          <ChannelCard key={c} status={status[c]} now={now} />
        ))}
      </div>
    </div>
  );
}
