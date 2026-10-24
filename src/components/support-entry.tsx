import { AddIndicatorForm, EditIndicatorForm, ReadingForm, RemoveIndicatorForm } from "@/components/support-forms";
import { indicatorStatus, sortIndicators, STATUS_LABEL, targetText, valueText } from "@/core/support-indicators";
import { dayText } from "@/lib/format";
import type { IndicatorRow } from "@/server/services/support-indicators";

/**
 * Where the owner defines support indicators and records their readings: in Data, Manual entry, with the other data a
 * person types. The Support functions screen only reads them.
 */
export function SupportEntry({ indicators, today }: { indicators: IndicatorRow[]; today: string }) {
  const rows = sortIndicators(indicators);
  return (
    <section aria-label="Support functions" className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Support functions: indicators and readings</h2>
        <p className="mt-1 text-xs text-muted">
          A few indicators per supporting department. Set the target and who answers for it, then record each reading with the day it was measured. Whatever is saved here appears on the Support functions screen; nothing is taken from the ERP.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No indicator yet. Add the first one below, for example “Supplier deliveries on time, at least 90%”.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((i) => (
            <article key={i.id} className="rounded-lg border border-line bg-white p-3">
              <p className="text-sm">
                <b>{i.name}</b> <span className="text-xs text-muted">{i.department}</span>
              </p>
              <p className="text-xs text-muted">
                Target {targetText(i.direction, i.target, i.unit)} · {i.actual === null ? "no reading yet" : `latest ${valueText(i.actual, i.unit)}${i.measuredOn ? ` on ${dayText(i.measuredOn)}` : ""}`} · {STATUS_LABEL[indicatorStatus(i.direction, i.target, i.actual)]}
              </p>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer font-medium">Record a reading</summary>
                <div className="mt-3">
                  <ReadingForm id={i.id} today={today} unit={i.unit} />
                </div>
              </details>
              <details className="mt-1 text-sm">
                <summary className="cursor-pointer font-medium">Change the indicator or its target</summary>
                <div className="mt-3 space-y-4">
                  <EditIndicatorForm id={i.id} values={{ function: i.department, name: i.name, unit: i.unit, direction: i.direction, target: String(i.target), responsible: i.responsible ?? "", consequence: i.consequence ?? "" }} />
                  <RemoveIndicatorForm id={i.id} />
                </div>
              </details>
            </article>
          ))}
        </div>
      )}
      <AddIndicatorForm />
    </section>
  );
}
