import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { canEditTender } from "@/core/permissions";
import { AUTHORITIES, LINE_LABEL, PHASES, STAGE, STATUS_LABEL, daysInStage, isAuthority, phaseOf, type PhaseKey } from "@/core/tender-flow";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";
import { dayText, jod } from "@/lib/format";
import { listTenders } from "@/server/services/tenders";

export const metadata: Metadata = { title: "Tenders" };

const PHASE_FILTERS: { key: PhaseKey; label: string }[] = [...PHASES, { key: "closed", label: "Lost or cancelled" }];

export default async function TendersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("tender");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const authority = isAuthority(one(sp.authority)) ? one(sp.authority) : "";
  const phase = PHASE_FILTERS.some((p) => p.key === one(sp.phase)) ? (one(sp.phase) as PhaseKey) : "";

  const today = businessToday();
  const all = await listTenders(getDb(), user.companyId);
  const rows = all.filter((t) => (!authority || t.authority === authority) && (!phase || phaseOf(t.status) === phase));
  const href = (next: { authority?: string; phase?: string }) => {
    const q = new URLSearchParams();
    const a = next.authority ?? authority;
    const p = next.phase ?? phase;
    if (a) q.set("authority", a);
    if (p) q.set("phase", p);
    const s = q.toString();
    return s ? `/tenders?${s}` : "/tenders";
  };
  const chip = (active: boolean) => `rounded-full border px-3 py-1 text-xs ${active ? "border-brand bg-brand text-brand-ink" : "border-line bg-white hover:border-brand"}`;

  return (
    <div className="space-y-5">
      <PageHeading
        eyebrow={`${user.companyName} · Tenders`}
        title="Tenders"
        sub="Every tender from the first sign of a purchase to the money collected. Open a tender to see its stage, details and history. Days in stage is only a count, not a deadline."
      />
      {canEditTender(user.role) ? (
        <Link href="/tenders/new" className="inline-block rounded-[7px] bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-[#125747]">
          Record a tender
        </Link>
      ) : null}

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2" aria-label="Filter by authority">
          <a href={href({ authority: "" })} className={chip(!authority)}>
            All authorities
          </a>
          {AUTHORITIES.map((a) => (
            <a key={a.code} href={href({ authority: a.code })} className={chip(authority === a.code)} title={a.name}>
              {a.code}
            </a>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Filter by phase">
          <a href={href({ phase: "" })} className={chip(!phase)}>
            All phases
          </a>
          {PHASE_FILTERS.map((p) => (
            <a key={p.key} href={href({ phase: p.key })} className={chip(phase === p.key)}>
              {p.label}
            </a>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-line bg-white p-5 text-sm text-muted">
          {all.length === 0 ? "No tenders recorded yet." : "No tender matches this filter."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Authority</th>
                <th className="px-3 py-2 font-medium">Tender</th>
                <th className="px-3 py-2 font-medium">Products</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 text-right font-medium">Estimated value</th>
                <th className="px-3 py-2 font-medium">Deadline</th>
                <th className="px-3 py-2 text-right font-medium">Days in stage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-t border-line align-top">
                  <td className="px-3 py-2 font-medium">{t.authority}</td>
                  <td className="px-3 py-2">
                    <a href={`/tenders/${t.id}`} className="underline decoration-line underline-offset-2 hover:decoration-brand">
                      {t.title}
                    </a>
                    {t.tenderNo ? <span className="block text-xs text-muted">{t.tenderNo}</span> : null}
                  </td>
                  <td className="px-3 py-2">{LINE_LABEL[t.productLine]}</td>
                  <td className="px-3 py-2">
                    {STATUS_LABEL[t.status]}
                    <span className="block text-xs text-muted">
                      Stage {STAGE[t.status].no} of 10
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.estimatedValue === null ? "—" : jod(t.estimatedValue)}</td>
                  <td className="px-3 py-2 tabular-nums">{t.deadline ? dayText(t.deadline) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{daysInStage(t.statusChangedAt, today)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
