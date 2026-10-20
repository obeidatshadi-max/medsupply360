import type { Metadata } from "next";
import Link from "next/link";
import { CustomerLink } from "@/components/customer-link";
import { PageHeading } from "@/components/page-heading";
import { PeriodTag } from "@/components/period-tag";
import { LOW_SHARE, OLD_UNIT_YEARS, REASON_LABEL, buildRadar } from "@/core/opportunity-radar";
import { requireUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";
import { jod, pct } from "@/lib/format";
import { companyInstalledBase } from "@/lib/installed-base";

export const metadata: Metadata = { title: "Opportunity radar" };

const n = (v: number) => v.toLocaleString("en-US");

export default async function OpportunityRadarPage() {
  const user = await requireUser();
  if (user.guest) {
    return <PageHeading eyebrow="Opportunity radar" title="Opportunity radar" sub="Please sign in with a company account to see this page. It uses the equipment list and the sales you loaded." />;
  }
  const today = businessToday();
  const base = await companyInstalledBase(user.companyId, today);

  if (base.totals.units === 0) {
    return (
      <div>
        <PageHeading
          eyebrow={`${user.companyName} · Opportunity radar`}
          title="Opportunity radar"
          sub="No installed equipment has been loaded yet. The radar looks for customers that buy less than their machines need, machines without a service contract, and older machines, so it needs the equipment list."
        />
        {user.role === "owner" ? (
          <Link href="/imports/manual" className="rounded-[7px] bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-[#125747]">
            Load installed equipment
          </Link>
        ) : null}
      </div>
    );
  }

  const r = buildRadar(base, today);
  const s = r.signals;
  const stats = [
    { label: "Monthly repeat-purchase gap", value: jod(Math.round(s.repeatGapMonthly)), note: `${n(s.repeatAccounts)} customer${s.repeatAccounts === 1 ? "" : "s"} buying under ${pct(LOW_SHARE)} of their estimate. To investigate, not a forecast` },
    { label: "Service contracts to sell or renew", value: `${n(s.serviceUnits)} machine${s.serviceUnits === 1 ? "" : "s"}`, note: s.serviceNotRecorded > 0 ? `${n(s.serviceNotRecorded)} more with no service status recorded` : "No contract, or expiring" },
    { label: "Older machines", value: `${n(s.olderUnits)} machine${s.olderUnits === 1 ? "" : "s"}`, note: `Installed ${OLD_UNIT_YEARS}+ years ago${s.ageNotRecorded > 0 ? `; ${n(s.ageNotRecorded)} with no install date` : ""}. No fixed replacement cycle` },
    { label: "Confirmed opportunity value", value: "Not qualified", note: "Needs the customer's need, budget, price and timing" },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow={`${user.companyName} · Opportunity radar`}
        title="Opportunity radar"
        sub="Where to look first for growth in the installed base. Each signal is a reason to start a conversation, not a sales forecast."
      />
      <PeriodTag from={base.window.from} to={base.window.to} label="Purchases" />
      <div className="grid grid-cols-2 gap-[10px] md:gap-[14px] min-[1000px]:grid-cols-4">
        {stats.map((x) => (
          <div key={x.label} className="rounded-[9px] border border-line bg-white p-[15px] md:p-[21px]">
            <p className="text-[11px] text-muted md:text-xs">{x.label}</p>
            <p className="my-2 text-2xl tracking-[-0.9px] md:text-[29px]">{x.value}</p>
            <p className="text-[10px] text-muted md:text-[11px]">{x.note}</p>
          </div>
        ))}
      </div>
      <p className="rounded-lg border border-line bg-white p-3 text-xs text-muted" role="note">
        The same customer can appear under more than one signal, so the three are never added into one value. Equipment age is a reason to ask about condition and plans, not proof that a machine must be replaced.
      </p>

      <section aria-label="Customers to qualify">
        <h2 className="text-sm font-semibold">Customers to qualify, most reasons first</h2>
        {r.accounts.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing stands out: every customer buys close to its estimate, its machines are under contract or in warranty, and none is old.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Why</th>
                  <th className="px-3 py-2 text-right font-medium">Share bought</th>
                  <th className="px-3 py-2 text-right font-medium">Gap / month</th>
                </tr>
              </thead>
              <tbody>
                {r.accounts.map((a) => (
                  <tr key={a.customerCode} className="border-t border-line align-top">
                    <td className="px-3 py-2">
                      <CustomerLink code={a.customerCode} name={a.customerName} />
                      {a.units.length > 0 ? (
                        <ul className="mt-1 space-y-0.5 text-xs text-muted">
                          {a.units.map((u) => (
                            <li key={u.code}>
                              {u.name} ({u.code}){u.age !== null ? `, ${u.age} yr` : ""}
                              {u.serviceFollowUp ? ", no active contract" : ""}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <ul className="flex flex-wrap gap-1">
                        {a.reasons.map((x) => (
                          <li key={x} className="rounded bg-brand-soft px-2 py-0.5 text-xs">
                            {REASON_LABEL[x]}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.share === null ? "—" : pct(a.share)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.gapMonthly === null ? "—" : jod(Math.round(a.gapMonthly))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-sm">
        <Link href="/installed-base" className="text-brand underline underline-offset-2">
          Installed base
        </Link>
        {" · "}
        <Link href="/service" className="text-brand underline underline-offset-2">
          Service &amp; support
        </Link>
      </p>
    </div>
  );
}
