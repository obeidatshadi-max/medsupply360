import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { AssignActionLink } from "@/components/assign-action-link";
import { canManageSupport } from "@/core/permissions";
import { STATUS_LABEL, indicatorStatus, sortIndicators, summarize, targetText, valueText, type IndicatorStatus } from "@/core/support-indicators";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";
import { dayText } from "@/lib/format";
import { listIndicators } from "@/server/services/support-indicators";
import { AddIndicatorForm, EditIndicatorForm, ReadingForm, RemoveIndicatorForm } from "./support-forms";

export const metadata: Metadata = { title: "Support functions" };

/** Who normally answers for each department, so the Assign action form opens with a sensible choice. */
const RESPONSIBLE_FOR: Record<string, string> = { Logistics: "Operations manager", Procurement: "Procurement manager", "HR & development": "HR manager", "Customer support": "Service manager", "Tender support": "Tender manager", Finance: "Finance manager" };

const CLASS: Record<IndicatorStatus, string> = { met: "bg-brand-soft text-ink", missed: "bg-bad-soft text-bad", no_reading: "border border-line bg-white text-muted" };

export default async function SupportFunctionsPage() {
  const user = await requireUser();
  if (user.guest) {
    return <PageHeading eyebrow="Support functions" title="Support functions" sub="Please sign in with a company account to see this page." />;
  }
  const today = businessToday();
  const rows = sortIndicators(await listIndicators(getDb(), user.companyId));
  const t = summarize(rows);
  const manage = canManageSupport(user.role);

  const stats = [
    { label: "Indicators followed", value: String(t.total), note: `${t.departments} department${t.departments === 1 ? "" : "s"}` },
    { label: "Off target", value: String(t.missed), note: "Latest reading misses the target" },
    { label: "On target", value: String(t.met), note: "Latest reading meets the target" },
    { label: "No reading yet", value: String(t.noReading), note: "Defined, but nobody has recorded a figure" },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow={`${user.companyName} · Support functions`}
        title="Support functions"
        sub="How the departments that serve the business are doing: logistics, procurement, HR, customer support and tender support. The owner sets each target and who answers for it, and a person records each reading. These figures are typed in, not taken from the ERP."
      />

      {rows.length === 0 ? (
        <p className="rounded-lg border border-line bg-white p-4 text-sm text-muted">{manage ? "No indicator has been defined yet. Add the first one below, for example “Supplier deliveries on time, at least 90%”." : "No indicator has been defined yet. The owner adds them here."}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-[10px] md:gap-[14px] min-[1000px]:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} data-figure className="rounded-[9px] border border-line bg-white p-[15px] md:p-[21px]">
                <p className="text-[11px] text-muted md:text-xs">{s.label}</p>
                <p className="my-2 text-2xl tracking-[-0.9px] md:text-[29px]">{s.value}</p>
                <p className="text-[10px] text-muted md:text-[11px]">{s.note}</p>
              </div>
            ))}
          </div>

          <section aria-label="Indicators">
            <p className="mb-2 text-xs text-muted">Off-target indicators come first, the biggest miss at the top. Targets are the company&rsquo;s own management assumptions.</p>
            <div className="space-y-3">
              {rows.map((i) => {
                const status = indicatorStatus(i.direction, i.target, i.actual);
                return (
                  <article key={i.id} className="rounded-lg border border-line bg-white p-4">
                    <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_1fr_1.4fr] md:items-start">
                      <div>
                        <p className="text-xs text-muted">{i.department}</p>
                        <p className="font-medium">{i.name}</p>
                        {i.responsible ? <p className="text-xs text-muted">Responsible: {i.responsible}</p> : null}
                      </div>
                      <div>
                        <p className="text-xs text-muted">Actual</p>
                        <p className="text-lg tabular-nums">{i.actual === null ? "—" : valueText(i.actual, i.unit)}</p>
                        {i.measuredOn ? <p className="text-xs text-muted">Measured {dayText(i.measuredOn)}{i.readingBy ? ` · ${i.readingBy}` : ""}</p> : null}
                      </div>
                      <div>
                        <p className="text-xs text-muted">Target</p>
                        <p className="text-lg tabular-nums">{targetText(i.direction, i.target, i.unit)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted">Status</p>
                        <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs ${CLASS[status]}`}>{STATUS_LABEL[status]}</span>
                        {status === "missed" ? (
                          <p className="mt-2">
                            <AssignActionLink role={user.role} title={`Fix: ${i.name}`} evidence={`${i.department}: ${valueText(i.actual ?? 0, i.unit)} against a target of ${targetText(i.direction, i.target, i.unit)}.${i.consequence ? ` ${i.consequence}.` : ""}`} responsible={RESPONSIBLE_FOR[i.department]} />
                          </p>
                        ) : null}
                      </div>
                      <div>
                        <p className="text-xs text-muted">Business consequence</p>
                        <p className="text-sm">{i.consequence ?? <span className="text-muted">Not written</span>}</p>
                      </div>
                    </div>
                    {manage ? (
                      <div className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
                        <details>
                          <summary className="cursor-pointer font-medium">Record a reading</summary>
                          <div className="mt-3">
                            <ReadingForm id={i.id} today={today} unit={i.unit} />
                          </div>
                        </details>
                        <details>
                          <summary className="cursor-pointer font-medium">Change the indicator or its target</summary>
                          <div className="mt-3 space-y-4">
                            <EditIndicatorForm
                              id={i.id}
                              values={{ function: i.department, name: i.name, unit: i.unit, direction: i.direction, target: String(i.target), responsible: i.responsible ?? "", consequence: i.consequence ?? "" }}
                            />
                            <RemoveIndicatorForm id={i.id} />
                          </div>
                        </details>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}

      {manage ? <AddIndicatorForm /> : null}
    </div>
  );
}
