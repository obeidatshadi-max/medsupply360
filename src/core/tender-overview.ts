/**
 * The owner's view of all tenders: where each phase stands, what is due, how much cash guarantees tie up, how often bids
 * win, and what the authorities still owe. Pure and shared by the page and the tests. Nothing here applies a time limit
 * to a stage: it lists facts (dates, counts, days) and leaves the judgement to the reader.
 */
import { AUTHORITIES, PHASES, daysInStage, phaseOf, type AuthorityCode, type PhaseKey, type TenderStatus } from "@/core/tender-flow";
import { guaranteeExposure, guaranteeState, paymentSummary } from "@/core/tender-money";

export interface OverviewTender {
  id: string;
  title: string;
  authority: AuthorityCode;
  status: TenderStatus;
  statusChangedAt: Date | string;
  estimatedValue: number | null;
  bidValue: number | null;
  awardAmount: number | null;
  contractValue: number | null;
  deadline: string | null;
  closeReason: string | null;
}

export interface OverviewGuarantee {
  tenderId: string;
  amount: number;
  expiresOn: string;
  returnedOn: string | null;
}

export interface OverviewInvoice {
  tenderId: string;
  amount: number;
  collected: number;
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

/** The best known value of a tender: the contract, else the award, else our bid, else the estimate. */
export function tenderValue(t: Pick<OverviewTender, "contractValue" | "awardAmount" | "bidValue" | "estimatedValue">): number | null {
  return t.contractValue ?? t.awardAmount ?? t.bidValue ?? t.estimatedValue ?? null;
}

const isWon = (s: TenderStatus) => s === "won" || s === "contracted" || s === "delivered" || s === "collected";
const BEFORE_SUBMISSION: readonly TenderStatus[] = ["pipeline", "open", "preparing"];
const isActive = (s: TenderStatus) => s !== "lost" && s !== "cancelled" && s !== "collected";

export interface PhaseSummary {
  key: PhaseKey;
  label: string;
  count: number;
  value: number;
  /** Tenders in this phase with no value entered yet, so the total is a floor. */
  withoutValue: number;
}

export interface TenderOverview {
  total: number;
  phases: PhaseSummary[];
  authorities: { code: AuthorityCode; active: number; activeValue: number; won: number; lost: number; unpaid: number }[];
  deadlines: { upcoming: { id: string; title: string; authority: AuthorityCode; deadline: string; daysLeft: number; status: TenderStatus }[]; passed: { id: string; title: string; authority: AuthorityCode; deadline: string; daysAgo: number; status: TenderStatus }[] };
  guarantees: { active: number; expiredNotReturned: number; count: number; soonest: { tenderId: string; title: string; authority: AuthorityCode; amount: number; expiresOn: string; daysLeft: number }[] };
  results: { won: number; lost: number; winRate: number | null; wonValue: number; recentLost: { id: string; title: string; authority: AuthorityCode; reason: string | null }[] };
  payments: { invoiced: number; collected: number; unpaid: number };
  longestInStage: { id: string; title: string; authority: AuthorityCode; status: TenderStatus; days: number }[];
}

const LABEL: Record<PhaseKey, string> = { ...Object.fromEntries(PHASES.map((p) => [p.key, p.label])), closed: "Lost or cancelled" } as Record<PhaseKey, string>;
const PHASE_ORDER: PhaseKey[] = [...PHASES.map((p) => p.key), "closed"];

export function buildTenderOverview(input: { today: string; tenders: OverviewTender[]; guarantees: OverviewGuarantee[]; invoices: OverviewInvoice[]; limit?: number }): TenderOverview {
  const { today, tenders } = input;
  const limit = input.limit ?? 5;
  const byId = new Map(tenders.map((t) => [t.id, t]));
  const diff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

  const phases: PhaseSummary[] = PHASE_ORDER.map((key) => ({ key, label: LABEL[key], count: 0, value: 0, withoutValue: 0 }));
  for (const t of tenders) {
    const p = phases.find((x) => x.key === phaseOf(t.status))!;
    p.count += 1;
    const v = tenderValue(t);
    if (v === null) p.withoutValue += 1;
    else p.value = round3(p.value + v);
  }

  // Invoices per tender, then per authority.
  const unpaidByTender = new Map<string, number>();
  const invoicesByTender = new Map<string, OverviewInvoice[]>();
  for (const inv of input.invoices) invoicesByTender.set(inv.tenderId, [...(invoicesByTender.get(inv.tenderId) ?? []), inv]);
  for (const [id, rows] of invoicesByTender) unpaidByTender.set(id, paymentSummary(rows).outstanding);

  const authorities = AUTHORITIES.map(({ code }) => {
    const mine = tenders.filter((t) => t.authority === code);
    const active = mine.filter((t) => isActive(t.status));
    return {
      code,
      active: active.length,
      activeValue: round3(active.reduce((s, t) => s + (tenderValue(t) ?? 0), 0)),
      won: mine.filter((t) => isWon(t.status)).length,
      lost: mine.filter((t) => t.status === "lost").length,
      unpaid: round3(mine.reduce((s, t) => s + (unpaidByTender.get(t.id) ?? 0), 0)),
    };
  });

  const preSubmission = tenders.filter((t) => BEFORE_SUBMISSION.includes(t.status) && t.deadline);
  const upcoming = preSubmission
    .filter((t) => t.deadline! >= today)
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!))
    .slice(0, limit)
    .map((t) => ({ id: t.id, title: t.title, authority: t.authority, deadline: t.deadline!, daysLeft: diff(today, t.deadline!), status: t.status }));
  const passed = preSubmission
    .filter((t) => t.deadline! < today)
    .sort((a, b) => b.deadline!.localeCompare(a.deadline!))
    .map((t) => ({ id: t.id, title: t.title, authority: t.authority, deadline: t.deadline!, daysAgo: diff(t.deadline!, today), status: t.status }));

  const exposure = guaranteeExposure(input.guarantees, today);
  const soonest = input.guarantees
    .filter((g) => guaranteeState(g, today).state === "active" && byId.has(g.tenderId))
    .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn))
    .slice(0, limit)
    .map((g) => {
      const t = byId.get(g.tenderId)!;
      return { tenderId: t.id, title: t.title, authority: t.authority, amount: g.amount, expiresOn: g.expiresOn, daysLeft: diff(today, g.expiresOn) };
    });

  const won = tenders.filter((t) => isWon(t.status));
  const lost = tenders.filter((t) => t.status === "lost");
  const decided = won.length + lost.length;

  const allInvoices = paymentSummary(input.invoices.map((i) => ({ amount: i.amount, collected: i.collected })));

  const longestInStage = tenders
    .filter((t) => isActive(t.status))
    .map((t) => ({ id: t.id, title: t.title, authority: t.authority, status: t.status, days: daysInStage(t.statusChangedAt, today) }))
    .sort((a, b) => b.days - a.days)
    .slice(0, limit);

  return {
    total: tenders.length,
    phases,
    authorities,
    deadlines: { upcoming, passed },
    guarantees: { active: exposure.active, expiredNotReturned: exposure.expiredNotReturned, count: input.guarantees.length, soonest },
    results: {
      won: won.length,
      lost: lost.length,
      winRate: decided === 0 ? null : won.length / decided,
      wonValue: round3(won.reduce((s, t) => s + (t.awardAmount ?? t.contractValue ?? 0), 0)),
      recentLost: lost.slice(0, limit).map((t) => ({ id: t.id, title: t.title, authority: t.authority, reason: t.closeReason })),
    },
    payments: { invoiced: allInvoices.invoiced, collected: allInvoices.collected, unpaid: allInvoices.outstanding },
    longestInStage,
  };
}
