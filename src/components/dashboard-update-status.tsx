/**
 * The one line under the top bar about the data: when it was last integrated. The current day and time and the screen's
 * release time are not shown, so this line is only about the figures the owner is reading.
 */
export function DashboardUpdateStatus({ sampleAsOf, integration }: { sampleAsOf?: string; integration?: string }) {
  return (
    <section aria-label="Data freshness" className="border-b border-line bg-brand-soft px-4 py-3 text-xs text-ink md:px-8">
      <span className="font-semibold">Data last integrated: </span>
      <span>{integration ?? "Not connected — no imports completed"}</span>
      {sampleAsOf ? <span> · Sample data as of {sampleAsOf}</span> : null}
    </section>
  );
}
