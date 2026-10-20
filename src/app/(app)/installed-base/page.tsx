import type { Metadata } from "next";
import Link from "next/link";
import { CustomerLink } from "@/components/customer-link";
import { PageHeading } from "@/components/page-heading";
import { PeriodTag } from "@/components/period-tag";
import { AssignActionLink } from "@/components/assign-action-link";
import { RecoveryScenario } from "@/components/recovery-scenario";
import { requireUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";
import { dayText, jod, pct } from "@/lib/format";
import { companyInstalledBase } from "@/lib/installed-base";

export const metadata: Metadata = { title: "Installed base" };

const n = (v: number) => v.toLocaleString("en-US");

export default async function InstalledBasePage() {
  const user = await requireUser();
  if (user.guest) {
    return <PageHeading eyebrow="Installed base" title="Installed base" sub="Please sign in with a company account to see this page. It uses the equipment list you loaded." />;
  }
  const r = await companyInstalledBase(user.companyId, businessToday());
  if (r.totals.units === 0) {
    return (
      <div>
        <PageHeading
          eyebrow={`${user.companyName} · Installed base`}
          title="Installed base"
          sub="No installed equipment has been loaded yet. Load the equipment list (customer, machine, warranty, and the consumables each should use per month) to see which customers buy less than their equipment needs."
        />
        {user.role === "owner" ? (
          <Link href="/imports/manual" className="rounded-[7px] bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-[#125747]">
            Load installed equipment
          </Link>
        ) : null}
      </div>
    );
  }

  const t = r.totals;
  const stats = [
    { label: "Installed units", value: n(t.units), note: `${n(t.customers)} customer${t.customers === 1 ? "" : "s"}${t.unitsWithoutEstimate > 0 ? `; ${n(t.unitsWithoutEstimate)} without an estimate` : ""}` },
    { label: "Expected consumables / month", value: jod(Math.round(t.expectedMonthly)), note: `Estimate typed on the equipment list, ${n(t.customersWithEstimate)} customer${t.customersWithEstimate === 1 ? "" : "s"} covered` },
    { label: "Bought / month", value: jod(Math.round(t.actualMonthly)), note: "Consumables sales to the same customers, monthly average" },
    { label: "Gap to investigate / month", value: jod(Math.round(t.gapMonthly)), note: "Expected less bought, customers that buy more are not netted off" },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow={`${user.companyName} · Installed base`}
        title="Installed base"
        sub="Equipment at customers, and whether they buy the consumables it should use. Sales are recorded per customer, so the comparison is made per customer. A gap is a reason to ask, not proof of a lost sale."
      />
      <PeriodTag from={r.window.from} to={r.window.to} label="Purchases" />
      {t.gapMonthly > 0 ? (
        <p>
          <AssignActionLink role={user.role} title="Look into the repeat consumable purchase gap" evidence={`Expected consumables exceed purchases by about ${jod(Math.round(t.gapMonthly))} a month across ${n(t.customersWithEstimate)} customer${t.customersWithEstimate === 1 ? "" : "s"}. Compare usage with purchases, stock, and alternate suppliers.`} responsible="Sales manager" label="Assign account review →" />
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-[10px] md:gap-[14px] min-[1000px]:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-[9px] border border-line bg-white p-[15px] md:p-[21px]">
            <p className="text-[11px] text-muted md:text-xs">{s.label}</p>
            <p className="my-2 text-2xl tracking-[-0.9px] md:text-[29px]">{s.value}</p>
            <p className="text-[10px] text-muted md:text-[11px]">{s.note}</p>
          </div>
        ))}
      </div>

      <section aria-label="Customers">
        <h2 className="text-sm font-semibold">Customers, biggest gap first</h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Customer and equipment</th>
                <th className="px-3 py-2 text-right font-medium">Expected / month</th>
                <th className="px-3 py-2 text-right font-medium">Bought / month</th>
                <th className="px-3 py-2 text-right font-medium">Share bought</th>
                <th className="px-3 py-2 text-right font-medium">Gap / month</th>
              </tr>
            </thead>
            <tbody>
              {r.accounts.map((a) => (
                <tr key={a.customerCode} className="border-t border-line align-top">
                  <td className="px-3 py-2">
                    <CustomerLink code={a.customerCode} name={a.customerName} />
                    <ul className="mt-1 space-y-0.5 text-xs text-muted">
                      {a.units.map((u) => (
                        <li key={u.code}>
                          {u.name} <span>({u.code})</span>
                          {u.flags.map((f) => (
                            <span key={f.text} className="ml-2 rounded bg-brand-soft px-1.5 py-0.5 text-[10px] text-ink">
                              {f.text}
                            </span>
                          ))}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.expectedMonthly === null ? <span className="text-muted">No estimate</span> : jod(Math.round(a.expectedMonthly))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{jod(Math.round(a.actualMonthly))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.share === null ? "—" : pct(a.share)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.gapMonthly === null ? "—" : jod(Math.round(a.gapMonthly))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {r.attention.length > 0 ? (
        <section aria-label="Warranty and service">
          <h2 className="text-sm font-semibold">Warranty and service to follow up</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {r.attention.map(({ unit, customerName, flags }) => (
              <li key={unit.code}>
                {unit.name} at {customerName}: {flags.map((f) => f.text).join(", ")}
                {unit.warrantyEnd ? <span className="text-xs text-muted"> (warranty end {dayText(unit.warrantyEnd)})</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {t.gapMonthly > 0 ? <RecoveryScenario gapMonthly={t.gapMonthly} /> : null}
    </div>
  );
}
