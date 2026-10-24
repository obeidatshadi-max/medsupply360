import { AdvancedGate } from "@/components/advanced-gate";
import { levelAllows } from "@/core/level";
import { currentLevel } from "@/lib/level";
import type { Metadata } from "next";
import Link from "next/link";
import { CustomerLink } from "@/components/customer-link";
import { PageHeading } from "@/components/page-heading";
import { LineFilter } from "@/components/line-filter";
import { currentLine } from "@/lib/line";
import { AssignActionLink } from "@/components/assign-action-link";
import { ACTION_GROUPS, GROUP_LABEL, SERVICE_GROUPS, buildServiceView, type ServiceGroup } from "@/core/service-support";
import { requireUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";
import { dayText, pct } from "@/lib/format";
import { companyInstalledUnits } from "@/lib/installed-base";
import { isDerivedCode } from "@/core/derived-units";

export const metadata: Metadata = { title: "Service & support" };

const n = (v: number) => v.toLocaleString("en-US");

/** Follow-up groups are shown in a gold tag; a covered or unrecorded machine in a quiet one. */
const tag = (g: ServiceGroup) => (ACTION_GROUPS.includes(g) ? "bg-gold-soft text-ink" : "bg-brand-soft text-ink");

function warrantyText(days: number | null, end: string | null): string {
  if (days === null || end === null) return "Not recorded";
  if (days < 0) return `Ended ${dayText(end)}`;
  return `${dayText(end)} (${n(days)} day${days === 1 ? "" : "s"} left)`;
}

export default async function ServicePage() {
  const user = await requireUser();
  if (!levelAllows(await currentLevel(), user.role, "/service")) return <AdvancedGate title="Service & support" />;
  if (user.guest) {
    return <PageHeading eyebrow="Service & support" title="Service & support" sub="Please sign in with a company account to see this page. It uses the sales you imported." />;
  }
  const today = businessToday();
  const line = await currentLine();
  const v = buildServiceView(await companyInstalledUnits(user.companyId, line), today);
  if (v.totals.units === 0 && line !== null) {
    return (
      <div>
        <PageHeading eyebrow={`${user.companyName} · Service & support`} title="Service & support" sub={`No installed machine belongs to ${line}. Choose another line.`} />
        <LineFilter current={line} />
      </div>
    );
  }

  if (v.totals.units === 0) {
    return (
      <div>
        <PageHeading
          eyebrow={`${user.companyName} · Service & support`}
          title="Service & support"
          sub="No equipment or devices appear in the imported sales yet. Every machine sold becomes a machine here; add its warranty end and service status in Data, Manual entry."
        />
        {user.role === "owner" ? (
          <Link href="/imports/manual" className="rounded-[7px] bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-[#125747]">
            Load installed equipment
          </Link>
        ) : null}
      </div>
    );
  }

  const t = v.totals;
  const stats = [
    { label: "Machines under contract", value: n(t.underContract), note: "Service status Active, as added in Data" },
    { label: "Contract coverage", value: t.coverage === null ? "—" : pct(t.coverage), note: `${n(t.underContract)} of ${n(t.units)} installed machines` },
    { label: "Contracts to sell or renew", value: n(t.toFollowUp), note: "No contract, or a contract that is expiring" },
    { label: "Service status not recorded", value: n(t.notRecorded), note: t.notRecorded > 0 ? "A gap in the list, not a sale: fill it in first" : "Every machine has a status" },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow={`${user.companyName} · Service & support`}
        title="Service & support"
        sub={`Which installed machines are under a service contract, and which are a contract to sell or renew, on ${dayText(today)}. Machines come from the sales you imported; a warranty end or service status shows only once the owner has added it in Data, Manual entry. The most urgent come first: out of warranty with no contract.`}
      />
      <LineFilter current={line} note="Machines follow the line of their product. A machine with no product on the list shows only under All lines." />
      {t.toFollowUp > 0 ? (
        <p>
          <AssignActionLink role={user.role} title="Convert uncovered service agreements" evidence={`${n(t.toFollowUp)} machine${t.toFollowUp === 1 ? " has" : "s have"} no active service contract or an expiring one. Quote account-specific coverage.`} responsible="Service manager" label="Assign service review →" />
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-[10px] md:gap-[14px] min-[1000px]:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} data-figure className="rounded-[9px] border border-line bg-white p-[15px] md:p-[21px]">
            <p className="text-[11px] text-muted md:text-xs">{s.label}</p>
            <p className="my-2 text-2xl tracking-[-0.9px] md:text-[29px]">{s.value}</p>
            <p className="text-[10px] text-muted md:text-[11px]">{s.note}</p>
          </div>
        ))}
      </div>

      <section aria-label="By group">
        <h2 className="text-sm font-semibold">Machines by service position</h2>
        <ul className="mt-2 flex flex-wrap gap-2 text-xs">
          {SERVICE_GROUPS.filter((g) => v.counts[g] > 0).map((g) => (
            <li key={g} className={`rounded-full px-3 py-1 ${tag(g)}`}>
              {GROUP_LABEL[g]}: <b>{n(v.counts[g])}</b>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Machines">
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Machine</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Warranty</th>
                <th className="px-3 py-2 font-medium">Service position</th>
              </tr>
            </thead>
            <tbody>
              {v.rows.map((r) => (
                <tr key={`${r.unit.customerCode}-${r.unit.code}`} className="border-t border-line align-top">
                  <td className="px-3 py-2">
                    <Link href={`/installed-base/${encodeURIComponent(r.unit.code)}`} className="underline decoration-line underline-offset-2 hover:decoration-brand">{r.unit.name}</Link>
                    {isDerivedCode(r.unit.code) ? null : <span className="block text-xs text-muted">{r.unit.code}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <CustomerLink code={r.unit.customerCode} name={r.unit.customerName} />
                  </td>
                  <td className="px-3 py-2 tabular-nums">{warrantyText(r.warrantyDays, r.unit.warrantyEnd)}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${tag(r.group)}`}>{GROUP_LABEL[r.group]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="rounded-lg border border-line bg-white p-3 text-xs text-muted" role="note">
        A contract opportunity needs a quotation for that customer. This page does not show usage, breakdowns or uptime: the app holds no service visits or operating hours, so it cannot say how well a machine is running.
      </p>
    </div>
  );
}
