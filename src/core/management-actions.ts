/**
 * Management actions: the owner's tracker of follow-ups ("look into the repeat purchase gap", "convert uncovered service
 * agreements"). Pure, so the form, the page and the demo apply the same rules. An action has a title, a responsible
 * department, a due date and the evidence that prompted it. Marking it done is a confirmation by a person: it does not
 * prove that any money was recovered, and the page says so.
 */
import { isIsoDate } from "./calc";

export const RESPONSIBLE = ["Sales manager", "Service manager", "Tender manager", "Finance manager", "Operations manager", "Procurement manager", "HR manager"] as const;
export const TITLE_MIN = 3;
export const TITLE_MAX = 180;
export const EVIDENCE_MAX = 1000;

export interface ActionForm {
  title: string;
  responsible: string;
  due: string;
  evidence: string;
}

export interface ActionValues {
  title: string;
  responsible: string;
  due: string;
  evidence: string | null;
}

export type ActionResult = { ok: true; value: ActionValues } | { ok: false; error: string };

const tidy = (v: unknown) =>
  String(v ?? "")
    .replace(/[\u0000-\u001f\u007f‎‏‪-‮]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function cleanAction(form: ActionForm): ActionResult {
  const title = tidy(form.title);
  if (title.length < TITLE_MIN || !/\p{L}/u.test(title)) return { ok: false, error: "Write what has to be done, for example “Look into the repeat purchase gap”." };
  if (title.length > TITLE_MAX) return { ok: false, error: `Use ${TITLE_MAX} characters or fewer for the action.` };
  const responsible = tidy(form.responsible);
  if (!(RESPONSIBLE as readonly string[]).includes(responsible)) return { ok: false, error: "Choose who is responsible." };
  const due = form.due.trim();
  if (!isIsoDate(due)) return { ok: false, error: "Choose the due date." };
  const evidence = tidy(form.evidence);
  if (evidence.length > EVIDENCE_MAX) return { ok: false, error: `Use ${EVIDENCE_MAX} characters or fewer for the evidence.` };
  return { ok: true, value: { title, responsible, due, evidence: evidence || null } };
}

export type ActionStatus = "open" | "done";
export const STATUS_LABEL: Record<ActionStatus, string> = { open: "Open", done: "Done" };

export interface ActionRow {
  status: ActionStatus;
  due: string;
  responsible: string;
  completedOn?: string | null;
}

/** An open action whose due date has passed. Done actions are never overdue. */
export const isOverdue = (a: Pick<ActionRow, "status" | "due">, today: string): boolean => a.status === "open" && a.due < today;

/** Open actions first, the most overdue at the top; then done, the most recently finished first. */
export function sortActions<T extends ActionRow>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    if (a.status === "open") return a.due.localeCompare(b.due);
    return (b.completedOn ?? "").localeCompare(a.completedOn ?? "");
  });
}

export function summarize(list: readonly ActionRow[], today: string) {
  const open = list.filter((a) => a.status === "open");
  return {
    open: open.length,
    done: list.length - open.length,
    overdue: open.filter((a) => isOverdue(a, today)).length,
    departments: new Set(open.map((a) => a.responsible)).size,
  };
}

/** A link to the add-action form on Management actions with the fields already filled in, for the "Assign" buttons on other screens. */
export function addActionHref(prefill: { title: string; evidence?: string; responsible?: string }): string {
  const q = new URLSearchParams();
  q.set("actionTitle", prefill.title.slice(0, TITLE_MAX));
  if (prefill.evidence) q.set("actionEvidence", prefill.evidence.slice(0, EVIDENCE_MAX));
  if (prefill.responsible && (RESPONSIBLE as readonly string[]).includes(prefill.responsible)) q.set("actionResponsible", prefill.responsible);
  return `/opportunities?${q.toString()}#add-action`;
}

/** What a page may pre-fill from the link above: only known values, never anything it cannot show safely. */
export function prefillFrom(params: Record<string, string | string[] | undefined>): { title: string; evidence: string; responsible: string } {
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const responsible = one(params.actionResponsible);
  return {
    title: tidy(one(params.actionTitle)).slice(0, TITLE_MAX),
    evidence: tidy(one(params.actionEvidence)).slice(0, EVIDENCE_MAX),
    responsible: (RESPONSIBLE as readonly string[]).includes(responsible) ? responsible : RESPONSIBLE[0],
  };
}
