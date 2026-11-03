import { CHANNEL_INFO, channelState, lastUpdateText, type ChannelStatus } from "@/core/channels";

const LABEL = { never: "No tender data yet", fresh: "Up to date", stale: "Needs an update" } as const;
const CLASS = { never: "bg-bad-soft text-bad", fresh: "bg-brand-soft text-brand", stale: "border border-line bg-white text-gold" } as const;

/**
 * One line for the owner (and the tender team) about the tender data: when it was last updated, by whom, and whether the
 * team is behind. It uses the same rule as the data hub, so the two never disagree.
 */
export function TenderDataStrip({ status, now, uploadHref }: { status: ChannelStatus; now: Date; uploadHref?: string | null }) {
  const state = channelState(status, now);
  const days = CHANNEL_INFO.tender.staleAfterDays;
  return (
    <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-white px-4 py-2.5 text-sm">
      <b>Tender data</b>
      <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${CLASS[state]}`}>{LABEL[state]}</span>
      <span className="text-muted">
        {lastUpdateText(status, now)}.{state === "stale" ? ` Nothing for more than ${days} days.` : ""}
      </span>
      {uploadHref ? (
        <a href={uploadHref} className="ms-auto rounded-md border border-brand px-3 py-1 text-xs font-semibold text-brand hover:bg-[#f0f6f2]">
          Upload tender files
        </a>
      ) : null}
    </p>
  );
}
