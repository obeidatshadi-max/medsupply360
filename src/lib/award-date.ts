import { businessToday } from "@/lib/business-date";

/** The date (Jordan time, YYYY-MM-DD) a tender last entered Won or Lost, or null if it never did. `history` is oldest first. */
export function awardDateOf(history: { toStatus: string; at: Date }[]): string | null {
  const decided = [...history].reverse().find((h) => h.toStatus === "won" || h.toStatus === "lost");
  return decided ? businessToday(decided.at) : null;
}
