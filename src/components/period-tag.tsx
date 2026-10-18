import { dateRange } from "@/lib/format";

/**
 * The period a money figure covers, as a small label next to the figure ("Period: 1 Jan – 30 Sep 2026").
 * Use it on every sales or cash number so the dates are never a guess. `against` names the comparison period.
 */
export function PeriodTag({ from, to, label = "Period", against }: { from: string; to: string; label?: string; against?: { from: string; to: string } }) {
  return (
    <p className="mt-1 inline-block rounded bg-brand-soft px-2 py-1 text-xs">
      <span className="font-semibold">{label}:</span> {dateRange(from, to)}
      {against ? <span className="text-muted"> · compared with {dateRange(against.from, against.to)}</span> : null}
    </p>
  );
}
