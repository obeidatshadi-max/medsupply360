import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeading } from "@/components/page-heading";
import { DataTabs } from "@/components/data-tabs";

export const metadata: Metadata = { title: "Tender department channel" };

export default async function TenderChannelPage() {
  const user = await requireUser();
  if (user.guest || user.role !== "owner") {
    return (
      <section className="rounded-lg border border-line bg-surface p-6">
        <h1 className="text-xl font-semibold">Tender department</h1>
        <p className="mt-2 text-sm text-muted">Only the company owner can load this data.</p>
      </section>
    );
  }
  return (
    <div className="space-y-6">
      <PageHeading eyebrow={`${user.companyName} · Data channels`} title="Tender department" sub="Tenders are recorded by the tender team in the Tenders section." />
      <DataTabs current="imports" owner history />
      <p className="text-sm">
        <Link href="/tenders" className="text-brand underline underline-offset-2">
          Open Tenders
        </Link>
      </p>
    </div>
  );
}
