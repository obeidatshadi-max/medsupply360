import { CHANNEL_INFO, channelState, lastUpdateText, type ChannelStatus } from "@/core/channels";

const STATE_LABEL = { never: "Not started", fresh: "Up to date", stale: "Needs an update" } as const;
const STATE_CLASS = { never: "bg-bad-soft text-bad", fresh: "bg-brand-soft text-brand", stale: "border border-line bg-white text-gold" } as const;

/** One channel on the data hub: who feeds it, when it last got data, what is missing, and a way in. */
export function ChannelCard({ status, now, href }: { status: ChannelStatus; now: Date; href?: string }) {
  const info = CHANNEL_INFO[status.channel];
  const state = channelState(status, now);
  return (
    <article aria-label={info.title} className="flex flex-col rounded-lg border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold">{info.title}</h2>
        <span className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-medium ${STATE_CLASS[state]}`}>{STATE_LABEL[state]}</span>
      </div>
      <p className="mt-1 text-xs text-muted">{info.summary}</p>
      <p className="mt-3 text-sm">{lastUpdateText(status, now)}</p>
      <p className="text-xs text-muted">Fed by: {info.feeder} · {info.cadence}</p>
      {status.facts.length > 0 ? (
        <ul className="mt-3 space-y-0.5 text-sm">
          {status.facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      ) : null}
      {status.missing.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-gold">Still missing</p>
          <ul className="mt-0.5 space-y-0.5 text-xs text-muted">
            {status.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <a href={href ?? info.href} className="mt-5 inline-block self-start rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-ink">
        Open {info.title}
      </a>
    </article>
  );
}
