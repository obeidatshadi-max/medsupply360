import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { ROLE_LABEL } from "@/core/permissions";
import { LINE_LABEL, STAGE, STATUS_LABEL, STATUSES, daysInStage } from "@/core/tender-flow";
import { requireUser } from "@/lib/auth/current-user";
import { dayText, jod } from "@/lib/format";
import { DEMO_TENDERS, DEMO_TENDER_AS_OF, demoTenderOverview } from "@/demo/tender-demo";
import { tenderValue } from "@/core/tender-overview";
import { OverviewPanel } from "../../tenders/overview-panel";

export const metadata: Metadata = { title: "Sample tenders" };

/** Made-up tenders, shown the way the live Tenders page shows real ones. Open to guests and to every business user. */
export default async function SampleTendersPage() {
  await requireUser();
  const overview = demoTenderOverview();
  const stages = STATUSES.filter((s) => s !== "lost" && s !== "cancelled");
  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Sample · Tenders"
        title="Tenders"
        sub={`Made-up demonstration tenders, on ${dayText(DEMO_TENDER_AS_OF)}. They use the real authority names but the titles, numbers and amounts are invented. In the live app the tender department and finance enter these as each tender moves, and the owner follows them here.`}
      />
      <OverviewPanel o={overview} base={null} />

      <section aria-label="All sample tenders" className="space-y-2">
        <h2 className="text-sm font-semibold">All tenders</h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Authority</th>
                <th className="px-3 py-2 font-medium">Tender</th>
                <th className="px-3 py-2 font-medium">Products</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 text-right font-medium">Value</th>
                <th className="px-3 py-2 font-medium">Deadline</th>
                <th className="px-3 py-2 text-right font-medium">Days in stage</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_TENDERS.map((t) => {
                const v = tenderValue(t);
                return (
                  <tr key={t.id} className="border-t border-line align-top">
                    <td className="px-3 py-2 font-medium">{t.authority}</td>
                    <td className="px-3 py-2">
                      {t.title}
                      {t.tenderNo ? <span className="block text-xs text-muted">{t.tenderNo}</span> : null}
                    </td>
                    <td className="px-3 py-2">{LINE_LABEL[t.productLine]}</td>
                    <td className="px-3 py-2">
                      {STATUS_LABEL[t.status]}
                      <span className="block text-xs text-muted">Stage {STAGE[t.status].no} of 10</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{v === null ? "—" : jod(v)}</td>
                    <td className="px-3 py-2 tabular-nums">{t.deadline ? dayText(t.deadline) : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{daysInStage(t.statusChangedAt, DEMO_TENDER_AS_OF)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="How a tender moves" className="space-y-2">
        <h2 className="text-sm font-semibold">How a tender moves</h2>
        <ol className="space-y-1 text-sm">
          {stages.map((s) => (
            <li key={s} className="rounded-lg border border-line bg-white px-4 py-2">
              <b>
                {STAGE[s].no}. {STAGE[s].name}
              </b>{" "}
              <span className="text-xs text-muted">Status: {s === "won" ? "Won, Lost or Cancelled" : STATUS_LABEL[s]}</span>
              <span className="block text-xs text-muted">{STAGE[s].action}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Who sees what" className="space-y-2">
        <h2 className="text-sm font-semibold">Who can do what</h2>
        <ul className="space-y-1 text-sm">
          {(["owner", "tender", "finance", "admin"] as const).map((r) => (
            <li key={r} className="rounded-lg border border-line bg-white px-4 py-2">
              <b>{ROLE_LABEL[r].name}</b>: <span className="text-muted">{ROLE_LABEL[r].note}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
