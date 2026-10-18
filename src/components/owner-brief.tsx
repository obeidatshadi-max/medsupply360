import type { Alert, Status } from "@/lib/owner-brief";
import { GLOSSARY, type Term } from "@/core/glossary";
import { signedPct, pct } from "@/lib/format";

/** Status look: colour is never the only cue, every status also has a word and a symbol. */
const LOOK: Record<
  Status,
  {
    word: string;
    icon: string;
    text: string;
    soft: string;
    bar: string;
    edge: string;
  }
> = {
  good: {
    word: "On track",
    icon: "✓",
    text: "text-brand",
    soft: "bg-brand-soft",
    bar: "bg-brand",
    edge: "border-l-brand",
  },
  watch: {
    word: "Watch",
    icon: "!",
    text: "text-warn",
    soft: "bg-warn-soft",
    bar: "bg-warn",
    edge: "border-l-warn",
  },
  act: {
    word: "Act now",
    icon: "!!",
    text: "text-bad",
    soft: "bg-bad-soft",
    bar: "bg-bad",
    edge: "border-l-bad",
  },
  nodata: {
    word: "No data yet",
    icon: "–",
    text: "text-muted",
    soft: "bg-canvas",
    bar: "bg-line",
    edge: "border-l-line",
  },
};

export type BriefVisual = { kind: "trend"; growth: number | string | null | undefined; against?: string } | { kind: "share"; share: number | null; of: string };

export interface BriefCard {
  title: string;
  status: Status;
  /** The one number, already formatted and short (for example "JOD 4.5M"). */
  value: string;
  /** One plain sentence: what it means. */
  verdict: string;
  href: string;
  visual: BriefVisual;
  /** When the figure is from, for example "1 Jan – 18 Oct 2026". Shown on the card so the date is never a guess. */
  when?: { label: string; text: string };
  /** Key terms to explain on the card, in simple words (from the shared glossary). */
  terms?: Term[];
}

function Visual({ v, status }: { v: BriefVisual; status: Status }) {
  const look = LOOK[status];
  if (v.kind === "trend") {
    if (typeof v.growth !== "number") return <p className="text-xs text-muted">No comparison with last year yet</p>;
    const up = v.growth >= 0;
    return (
      <p className={`flex items-center gap-2 text-sm font-semibold ${look.text}`}>
        <span aria-hidden className="text-xl leading-none">
          {up ? "▲" : "▼"}
        </span>
        {signedPct(v.growth, 0)} <span className="text-xs font-normal text-muted">vs same dates last year{v.against ? ` (${v.against})` : ""}</span>
      </p>
    );
  }
  if (v.share === null) return <p className="text-xs text-muted">Needs the file first</p>;
  const w = Math.max(2, Math.min(100, Math.round(v.share * 100)));
  return (
    <div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-canvas" role="img" aria-label={`${pct(v.share)} ${v.of}`}>
        <div className={`h-full rounded-full ${look.bar}`} style={{ width: `${w}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-muted">
        <span className={`font-semibold ${look.text}`}>{pct(v.share)}</span> {v.of}
      </p>
    </div>
  );
}

function Card({ c }: { c: BriefCard }) {
  const look = LOOK[c.status];
  return (
    <a href={c.href} className={`flex h-full flex-col rounded-[10px] border border-line border-l-4 bg-white p-5 hover:border-brand ${look.edge}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{c.title}</p>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${look.soft} ${look.text}`}>
          <span aria-hidden>{look.icon} </span>
          {look.word}
        </span>
      </div>
      {c.when ? (
        <p className="mt-2 inline-block rounded bg-brand-soft px-2 py-1 text-xs">
          <span className="font-semibold">{c.when.label}:</span> {c.when.text}
        </p>
      ) : null}
      <p className="my-3 text-[32px] font-medium leading-none tracking-[-1px]">{c.value}</p>
      <Visual v={c.visual} status={c.status} />
      <p className="mt-3 text-xs font-semibold">{c.verdict}</p>
      {c.terms?.length ? (
        <dl className="mt-3 space-y-1 border-t border-dashed border-line pt-2.5">
          {c.terms.map((t) => (
            <div key={t} className="text-[11.5px] leading-snug text-muted">
              <dt className="mr-1 inline rounded bg-canvas px-1 font-semibold text-ink">{t}</dt>
              <dd className="inline">{GLOSSARY[t]}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </a>
  );
}

function Banner({ alerts, anyData, anyGap }: { alerts: Alert[]; anyData: boolean; anyGap: boolean }) {
  if (!anyData) return null;
  if (alerts.length === 0) {
    return (
      <div className="mb-5 flex items-center gap-3 rounded-[10px] bg-brand-soft p-5 text-brand">
        <span aria-hidden className="text-2xl">
          ✓
        </span>
        <div>
          <p className="text-base font-semibold">Nothing urgent right now</p>
          <p className="text-xs">{anyGap ? "Some areas have no data yet, so they are not judged." : "Sales, cash, payments and stock are all on track."}</p>
        </div>
      </div>
    );
  }
  const act = alerts.some((a) => a.level === "act");
  return (
    <div className={`mb-5 rounded-[10px] p-5 ${act ? "bg-bad-soft" : "bg-warn-soft"}`} role="status">
      <p className={`mb-2 text-base font-semibold ${act ? "text-bad" : "text-warn"}`}>
        {alerts.length === 1 ? "1 thing needs your attention" : `${alerts.length} things need your attention`}
      </p>
      <ul className="space-y-1.5">
        {alerts.map((a) => (
          <li key={a.topic}>
            <a href={a.href} className="flex items-start gap-2 text-sm hover:underline">
              <span aria-hidden className={`mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${a.level === "act" ? "bg-bad" : "bg-warn"}`} />
              <span>{a.text}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Top of the owner overview: one alert banner and four big status cards. Details live further down the page. */
export function OwnerBrief({ cards, alerts }: { cards: BriefCard[]; alerts: Alert[] }) {
  const anyData = cards.some((c) => c.status !== "nodata");
  const anyGap = cards.some((c) => c.status === "nodata");
  return (
    <section aria-label="Summary for the owner" className="mb-8">
      <Banner alerts={alerts} anyData={anyData} anyGap={anyGap} />
      <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 min-[1000px]:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.title} c={c} />
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted">
        How we judge: sales and cash against the same dates last year; overdue = share of unpaid invoices past due (watch from 10%, act from 25%); stock = slow
        or expiring share of what you own (watch from 15%, act from 30%).
      </p>
    </section>
  );
}
