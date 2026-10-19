import type { Metadata } from "next";
import Link from "next/link";
import { DataTabs } from "@/components/data-tabs";
import { PageHeading } from "@/components/page-heading";
import { canSeeHistory } from "@/core/permissions";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth/current-user";
import { listDataHistory } from "@/server/services/data-history";

export const metadata: Metadata = { title: "Update history" };

/** Same clock as the header strip: Jordan time. */
const jordanTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Amman", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

export default async function HistoryPage() {
  const user = await requireUser();
  if (user.guest || !canSeeHistory(user.role)) {
    return (
      <section className="rounded-lg border border-line bg-surface p-6">
        <h1 className="text-xl font-semibold">Update history</h1>
        <p className="mt-2 text-sm text-muted">Only the company owner and administrators can read the update history.</p>
      </section>
    );
  }
  const rows = await listDataHistory(getDb(), user.companyId);

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow={`${user.companyName} · Alpha ERP data`}
        title="Update history"
        sub="Who entered or changed data, and when. Each person types their name on the form; the date and time are set automatically (Jordan time). The newest 200 changes are shown."
      />
      <DataTabs current="history" owner={user.role === "owner"} history />
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Nothing has been entered yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">When (Jordan time)</th>
                <th className="px-3 py-2 font-medium">Who</th>
                <th className="px-3 py-2 font-medium">Area</th>
                <th className="px-3 py-2 font-medium">What</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="px-3 py-2 tabular-nums">{jordanTime.format(r.at)}</td>
                  <td className="px-3 py-2">
                    {r.submittedBy ?? <span className="text-muted">Name not recorded</span>}
                    {r.account ? <span className="block text-xs text-muted">Account: {r.account}</span> : null}
                  </td>
                  <td className="px-3 py-2">{r.area}</td>
                  <td className="px-3 py-2">
                    {r.text}
                    {r.tenderId ? (
                      <span className="block text-xs">
                        <Link href={`/tenders/${r.tenderId}`} className="underline underline-offset-2">
                          {r.tenderTitle}
                        </Link>
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
