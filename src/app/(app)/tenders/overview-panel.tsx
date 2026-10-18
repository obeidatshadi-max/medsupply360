import Link from "next/link";
import { STATUS_LABEL } from "@/core/tender-flow";
import type { TenderOverview } from "@/core/tender-overview";
import { dayText, jod, pct } from "@/lib/format";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const card = "rounded-lg border border-line bg-white p-4";
const link = "underline decoration-line underline-offset-2 hover:decoration-brand";

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm text-muted">{children}</p>;
}

/** The owner's overview: what stands where, what is due, what cash is tied up, how bids fare and what is still unpaid. */
export function OverviewPanel({ o }: { o: TenderOverview }) {
  if (o.total === 0) return null;
  const open = o.phases.filter((p) => p.key !== "closed");
  const closed = o.phases.find((p) => p.key === "closed")!;
  const largest = Math.max(1, ...open.map((p) => p.value));

  return (
    <section aria-label="Tender overview" className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Where the tenders stand</h2>
        <p className="mt-1 text-xs text-muted">Value is the contract if there is one, otherwise the award, our bid, or the estimate. Tenders without any value are counted but not added.</p>
        <div className="mt-2 grid grid-cols-2 gap-[10px] min-[1000px]:grid-cols-4">
          {open.map((p) => (
            <div key={p.key} className={card}>
              <p className="text-xs text-muted">{p.label}</p>
              <p className="my-1 text-2xl font-medium tracking-[-0.6px]">{plural(p.count, "tender")}</p>
              <p className="text-sm tabular-nums">{jod(p.value)}</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-canvas" aria-hidden>
                <div className="h-full rounded-full bg-brand" style={{ width: `${p.value === 0 ? 0 : Math.max(3, Math.round((p.value / largest) * 100))}%` }} />
              </div>
              {p.withoutValue > 0 ? <p className="mt-1 text-[11px] text-muted">{plural(p.withoutValue, "tender")} without a value</p> : null}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Lost or cancelled: {closed.count}. Win rate:{" "}
          {o.results.winRate === null ? "not known yet (no tender has been decided)" : `${pct(o.results.winRate)} (${o.results.won} won, ${o.results.lost} lost${o.results.wonValue > 0 ? `, ${jod(o.results.wonValue)} awarded` : ""})`}.
        </p>
      </div>

      <div className="grid gap-[10px] md:grid-cols-2">
        <div className={card}>
          <h3 className="text-sm font-semibold">Submission deadlines</h3>
          {o.deadlines.upcoming.length === 0 ? (
            <Empty>No tender is waiting to be submitted with a deadline ahead.</Empty>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm">
              {o.deadlines.upcoming.map((d) => (
                <li key={d.id} className="flex flex-wrap justify-between gap-x-3">
                  <span>
                    <Link href={`/tenders/${d.id}`} className={link}>
                      {d.title}
                    </Link>{" "}
                    <span className="text-xs text-muted">
                      {d.authority} · {STATUS_LABEL[d.status]}
                    </span>
                  </span>
                  <span className="text-xs tabular-nums text-muted">
                    {dayText(d.deadline)} · {d.daysLeft === 0 ? "today" : plural(d.daysLeft, "day") + " left"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {o.deadlines.passed.length > 0 ? (
            <div className="mt-3 border-t border-dashed border-line pt-2">
              <p className="text-xs font-semibold text-bad">Deadline passed, not yet submitted</p>
              <ul className="mt-1 space-y-1 text-sm">
                {o.deadlines.passed.map((d) => (
                  <li key={d.id} className="flex flex-wrap justify-between gap-x-3">
                    <Link href={`/tenders/${d.id}`} className={link}>
                      {d.title} <span className="text-xs text-muted">{d.authority}</span>
                    </Link>
                    <span className="text-xs tabular-nums text-muted">
                      {dayText(d.deadline)} · {plural(d.daysAgo, "day")} ago
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className={card}>
          <h3 className="text-sm font-semibold">Cash tied up in guarantees</h3>
          <p className="my-1 text-2xl font-medium tracking-[-0.6px] tabular-nums">{jod(o.guarantees.active)}</p>
          <p className="text-xs text-muted">Held by guarantees that are not returned and not expired.</p>
          {o.guarantees.expiredNotReturned > 0 ? (
            <p className="mt-2 text-sm text-bad">{jod(o.guarantees.expiredNotReturned)} is on guarantees that expired but were not returned. Ask the bank.</p>
          ) : null}
          {o.guarantees.soonest.length === 0 ? (
            <Empty>{o.guarantees.count === 0 ? "No guarantee recorded yet." : "No active guarantee."}</Empty>
          ) : (
            <ul className="mt-3 space-y-1.5 border-t border-dashed border-line pt-2 text-sm">
              {o.guarantees.soonest.map((g, i) => (
                <li key={`${g.tenderId}-${i}`} className="flex flex-wrap justify-between gap-x-3">
                  <span>
                    <Link href={`/tenders/${g.tenderId}`} className={link}>
                      {g.title}
                    </Link>{" "}
                    <span className="text-xs tabular-nums text-muted">{jod(g.amount)}</span>
                  </span>
                  <span className="text-xs tabular-nums text-muted">
                    expires {dayText(g.expiresOn)} · {g.daysLeft === 0 ? "today" : plural(g.daysLeft, "day") + " left"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={card}>
          <h3 className="text-sm font-semibold">Still unpaid by the authorities</h3>
          <p className="my-1 text-2xl font-medium tracking-[-0.6px] tabular-nums">{jod(o.payments.unpaid)}</p>
          <p className="text-xs text-muted">
            Invoiced {jod(o.payments.invoiced)} · collected {jod(o.payments.collected)}
          </p>
          <ul className="mt-3 space-y-1 border-t border-dashed border-line pt-2 text-sm">
            {o.authorities
              .filter((a) => a.unpaid > 0)
              .sort((x, y) => y.unpaid - x.unpaid)
              .map((a) => (
                <li key={a.code} className="flex justify-between">
                  <span>{a.code}</span>
                  <span className="tabular-nums">{jod(a.unpaid)}</span>
                </li>
              ))}
            {o.payments.unpaid === 0 ? <li className="text-muted">Nothing is waiting to be collected.</li> : null}
          </ul>
        </div>

        <div className={card}>
          <h3 className="text-sm font-semibold">Why bids were lost</h3>
          {o.results.recentLost.length === 0 ? (
            <Empty>No tender has been marked lost.</Empty>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm">
              {o.results.recentLost.map((l) => (
                <li key={l.id}>
                  <Link href={`/tenders/${l.id}`} className={link}>
                    {l.title}
                  </Link>{" "}
                  <span className="text-xs text-muted">{l.authority}</span>
                  <span className="block text-xs text-muted">{l.reason ?? "No reason recorded"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-[10px] md:grid-cols-2">
        <div className={card}>
          <h3 className="text-sm font-semibold">By authority</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-1 pr-3 font-medium">Authority</th>
                  <th className="py-1 pr-3 text-right font-medium">Active</th>
                  <th className="py-1 pr-3 text-right font-medium">Active value</th>
                  <th className="py-1 pr-3 text-right font-medium">Won</th>
                  <th className="py-1 text-right font-medium">Lost</th>
                </tr>
              </thead>
              <tbody>
                {o.authorities.map((a) => (
                  <tr key={a.code} className="border-t border-line">
                    <td className="py-1 pr-3 font-medium">{a.code}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{a.active}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{a.activeValue === 0 ? "—" : jod(a.activeValue)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{a.won}</td>
                    <td className="py-1 text-right tabular-nums">{a.lost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={card}>
          <h3 className="text-sm font-semibold">Longest in their current stage</h3>
          <p className="mt-1 text-xs text-muted">A plain count of days, not a deadline: some stages are slow by nature.</p>
          {o.longestInStage.length === 0 ? (
            <Empty>No active tender.</Empty>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm">
              {o.longestInStage.map((t) => (
                <li key={t.id} className="flex flex-wrap justify-between gap-x-3">
                  <span>
                    <Link href={`/tenders/${t.id}`} className={link}>
                      {t.title}
                    </Link>{" "}
                    <span className="text-xs text-muted">
                      {t.authority} · {STATUS_LABEL[t.status]}
                    </span>
                  </span>
                  <span className="text-xs tabular-nums text-muted">{plural(t.days, "day")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
