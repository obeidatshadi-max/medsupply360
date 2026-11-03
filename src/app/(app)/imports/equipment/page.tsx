import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeading } from "@/components/page-heading";
import { SmartUpload } from "@/components/smart-upload";
import { TemplateDownloads } from "@/components/template-downloads";
import { RecentImports } from "@/components/recent-imports";
import { MachineDetailsForm } from "@/components/machine-details-form";
import { ServiceDataStrip } from "@/components/service-data-strip";
import { MAINTENANCE_UPLOAD_KINDS, canUploadEquipment } from "@/core/permissions";
import { companyInstalledUnits } from "@/lib/installed-base";
import { lastServiceUpdate } from "@/lib/service-data";

export const metadata: Metadata = { title: "Upload equipment" };

/** The maintenance department's page: the installed equipment file, with contracts and contacts, and the machine details form. */
export default async function EquipmentUploadPage() {
  const user = await requireUser("service");
  if (user.guest || !canUploadEquipment(user.role)) {
    return (
      <section className="rounded-lg border border-line bg-surface p-6">
        <h1 className="text-xl font-semibold">Upload equipment</h1>
        <p className="mt-2 text-sm text-muted">Only the owner and the maintenance department can load the equipment list.</p>
      </section>
    );
  }
  const kinds = MAINTENANCE_UPLOAD_KINDS;
  const [units, last] = await Promise.all([companyInstalledUnits(user.companyId), lastServiceUpdate(user.companyId)]);
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
        eyebrow={`${user.companyName} · Maintenance`}
        title="Upload equipment"
        sub="Upload the installed equipment list as Excel or CSV: each machine with its customer, install date, warranty, service contract dates and the contact to call. You see a preview first and nothing is saved until you confirm. A machine already recorded is updated; a blank contract or contact cell keeps what is recorded. The owner can see every update."
      />
      <ServiceDataStrip lastUpdate={last.lastUpdate} by={last.by} now={new Date()} />
      <p className="text-sm">
        <Link href="/installed-base" className="text-brand underline underline-offset-2">
          Installed base
        </Link>
        {" · "}
        <Link href="/service" className="text-brand underline underline-offset-2">
          Service &amp; support
        </Link>
      </p>
      <SmartUpload companyId={user.companyId} allowed={kinds} noun="your installed-equipment list" />
      <TemplateDownloads kinds={kinds} />
      <MachineDetailsForm machines={machines} />
      <RecentImports companyId={user.companyId} kinds={kinds} />
    </div>
  );
}
