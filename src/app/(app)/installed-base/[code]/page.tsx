import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdvancedGate } from "@/components/advanced-gate";
import { AssignActionLink } from "@/components/assign-action-link";
import { CustomerLink } from "@/components/customer-link";
import { PageHeading } from "@/components/page-heading";
import { PeriodTag } from "@/components/period-tag";
import { levelAllows } from "@/core/level";
import { ageYears } from "@/core/opportunity-radar";
import { GROUP_LABEL, serviceGroup } from "@/core/service-support";
import { requireUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";
import { dayText, jod, pct } from "@/lib/format";
import { currentLevel } from "@/lib/level";
import { companyUnitDetail } from "@/lib/unit-detail";

export const metadata: Metadata = { title: "Installed machine" };

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-t border-line py-2 text-sm first:border-t-0">
      <span className="text-muted">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

export default async function UnitPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireUser();
  if (!levelAllows(await currentLevel(), user.role, "/installed-base")) return <AdvancedGate title="Installed base" />;
  if (user.guest) return <PageHeading eyebrow="Installed base" title="Installed machine" sub="Please sign in with a company account to see this page." />;
  const { code } = await params;
  const today = businessToday();
  const d = await companyUnitDetail(user.companyId, decodeURIComponent(code), today);
  if (!d) notFound();
  const { unit, account } = d;
  const age = ageYears(unit.installedOn, today);
  const group = serviceGroup(unit, today);
  const gap = account.gapMonthly;

  const tiles = [
    { label: "Expected consumables / month", value: account.expectedMonthly === null ? "No estimate" : jod(Math.round(account.expectedMonthly)), note: account.expectedSource === "history" ? "The customer's own earlier purchases, all machines of this customer" : "Estimate typed in Data, all machines of this customer" },
    { label: "Bought / month", value: jod(Math.round(account.actualMonthly)), note: "Consumables sales to this customer, monthly average" },
    { label: "Share of expected bought", value: account.share === null ? "—" : pct(account.share), note: "Above 100% means more than the estimate" },
    { label: "Gap to investigate / month", value: gap === null ? "—" : jod(Math.round(gap)), note: "Not a confirmed loss" },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow={`${user.companyName} · Installed machine · ${unit.code}`}
        title={unit.name}
        sub={`At ${account.customerName}${unit.installedOn ? `, ${unit.source === "erp" ? "first sold" : "installed"} ${dayText(unit.installedOn)}` : ""}. Purchases are recorded per customer, so the figures below cover all ${account.units.length} machine${account.units.length === 1 ? "" : "s"} this customer holds.`}
      />
      <PeriodTag from={d.window.from} to={d.window.to} label="Purchases" />
      <div className="grid grid-cols-2 gap-[10px] md:gap-[14px] min-[1000px]:grid-cols-4">
        {tiles.map((s) => (
          <div key={s.label} data-figure className="rounded-[9px] border border-line bg-white p-[15px] md:p-[21px]">
            <p className="text-[11px] text-muted md:text-xs">{s.label}</p>
            <p className="my-2 text-2xl tracking-[-0.9px] md:text-[29px]">{s.value}</p>
            <p className="text-[10px] text-muted md:text-[11px]">{s.note}</p>
          </div>
        ))}
      </div>

      <section aria-label="Machine facts" className="rounded-lg border border-line bg-white px-4 py-2">
        <Fact label="Customer">
          <CustomerLink code={account.customerCode} name={account.customerName} />
        </Fact>
        <Fact label="Product on the list">{d.product ? `${d.product.name} (${d.product.code})` : <span className="text-muted">Not linked to a product</span>}</Fact>
        <Fact label="Business line of the machine">{d.product?.line ?? <span className="text-muted">Unknown without a product</span>}</Fact>
        <Fact label="Supplier">{d.product?.supplier ?? <span className="text-muted">Not written</span>}</Fact>
        <Fact label={unit.source === "erp" ? "Time since first sold" : "Age"}>{age === null ? <span className="text-muted">Install date not recorded</span> : `${age} year${age === 1 ? "" : "s"}`}</Fact>
        <Fact label="Warranty ends">{unit.warrantyEnd ? dayText(unit.warrantyEnd) : <span className="text-muted">Not recorded</span>}</Fact>
        <Fact label="Service position">{GROUP_LABEL[group]}</Fact>
        <Fact label="Estimate for this machine alone">{unit.expectedMonthly === null ? <span className="text-muted">None</span> : `${jod(unit.expectedMonthly)} a month`}</Fact>
      </section>

      {unit.flags.length > 0 ? <p className="rounded-lg border border-line bg-white p-3 text-sm">{unit.flags.map((f) => f.text).join(" · ")}</p> : null}

      <section aria-label="Linked consumables">
        <h2 className="text-sm font-semibold">Consumables this customer bought</h2>
        {d.linked.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No consumables were bought in this period.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 text-right font-medium">Sales in the period</th>
                </tr>
              </thead>
              <tbody>
                {d.linked.map((l) => (
                  <tr key={l.code} className="border-t border-line">
                    <td className="px-3 py-2">
                      {l.name} <span className="text-xs text-muted">{l.code}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{jod(Math.round(l.sales))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-muted">Consumables are not tied to one machine in the sales file, so these are the customer&rsquo;s purchases, not this machine&rsquo;s alone.</p>
      </section>

      {d.otherUnits.length > 0 ? (
        <section aria-label="Other machines of this customer">
          <h2 className="text-sm font-semibold">Other machines at {account.customerName}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {d.otherUnits.map((u) => (
              <li key={u.code}>
                <Link href={`/installed-base/${encodeURIComponent(u.code)}`} className="underline underline-offset-2">
                  {u.name}
                </Link>{" "}
                <span className="text-xs text-muted">{u.code}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="rounded-lg border border-line bg-white p-3 text-xs text-muted" role="note">
        Check usage, customer-held stock, alternate supply, compatibility and service issues. A purchasing gap alone does not establish lost profit.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <AssignActionLink
          role={user.role}
          title={`Review repeat revenue at ${account.customerName}`}
          evidence={`${unit.code} (${unit.name})${gap !== null && gap > 0 ? ` · about ${jod(Math.round(gap))} a month estimated purchase gap` : ""}`}
          responsible="Sales manager"
          label="Assign account review →"
        />
        <Link href="/installed-base" className="text-sm text-brand underline underline-offset-2">
          Back to Installed base
        </Link>
      </div>
    </div>
  );
}
