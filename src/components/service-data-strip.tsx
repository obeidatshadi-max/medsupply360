import { serviceDataState, serviceDataText, SERVICE_STALE_AFTER_DAYS } from "@/core/service-data";

const LABEL = { never: "No service data yet", fresh: "Up to date", stale: "Needs an update" } as const;
const CLASS = { never: "bg-bad-soft text-bad", fresh: "bg-brand-soft text-brand", stale: "border border-line bg-white text-gold" } as const;

/** One line about the service data: when the equipment file or machine details last changed, and whether the maintenance team is behind. */
export function ServiceDataStrip({ lastUpdate, by, now, uploadHref }: { lastUpdate: string | null; by: string | null; now: Date; uploadHref?: string | null }) {
  const state = serviceDataState(lastUpdate, now);
  return (
    <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-white px-4 py-2.5 text-sm">
      <b>Service data</b>
      <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${CLASS[state]}`}>{LABEL[state]}</span>
      <span className="text-muted">
        {serviceDataText(lastUpdate, by, now)}.{state === "stale" ? ` Nothing for more than ${SERVICE_STALE_AFTER_DAYS} days.` : ""}
      </span>
      {uploadHref ? (
        <a href={uploadHref} className="ms-auto rounded-md border border-brand px-3 py-1 text-xs font-semibold text-brand hover:bg-[#f0f6f2]">
          Update equipment data
        </a>
      ) : null}
    </p>
  );
}
