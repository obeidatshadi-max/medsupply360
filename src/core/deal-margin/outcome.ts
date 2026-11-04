/**
 * Verified outcome tracking: did an action actually protect or recover margin? The baseline is captured when the action is
 * created; the check compares the CURRENT deterministic findings with it. A person marking an action "done" proves nothing
 * on its own: only the recalculated numbers say whether the intervention worked.
 */
export interface ActionBaseline {
  findingKey: string;
  takenOn: string;
  /** Forecast contribution margin (percent) when the action was created. */
  marginPct: number | null;
  /** The finding's impact in JOD at that time. */
  impactJod: number;
  /** Forecast contribution in JOD at that time. */
  contributionJod: number;
}

export interface CurrentState {
  marginPct: number | null;
  contributionJod: number;
  /** Impact of the same finding now, or null when the rules no longer raise it. */
  impactJod: number | null;
}

export type OutcomeVerdict = "resolved" | "improved" | "no_change" | "worsened";

export interface Outcome {
  verdict: OutcomeVerdict;
  /** Profit protected or recovered since the baseline, in JOD (negative = lost more). */
  profitRecoveredJod: number;
  marginChangePp: number | null;
  explanation: string;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function verifyOutcome(base: ActionBaseline, now: CurrentState): Outcome {
  const profitRecoveredJod = r3(now.contributionJod - base.contributionJod);
  const marginChangePp = base.marginPct === null || now.marginPct === null ? null : Math.round((now.marginPct - base.marginPct) * 10) / 10;
  if (now.impactJod === null) {
    return { verdict: "resolved", profitRecoveredJod, marginChangePp, explanation: `The rules no longer raise this finding. Forecast profit moved by JOD ${profitRecoveredJod.toFixed(3)} since the action.` };
  }
  const drop = r3(base.impactJod - now.impactJod);
  if (drop > 0.0005) return { verdict: "improved", profitRecoveredJod, marginChangePp, explanation: `The finding is still raised but its impact fell by JOD ${drop.toFixed(3)}.` };
  if (drop < -0.0005) return { verdict: "worsened", profitRecoveredJod, marginChangePp, explanation: `The impact grew by JOD ${(-drop).toFixed(3)} since the action.` };
  return { verdict: "no_change", profitRecoveredJod, marginChangePp, explanation: "The impact is unchanged: the action has not yet had an effect." };
}
