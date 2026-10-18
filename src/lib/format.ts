const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });

/** "JOD 1,234" (fils shown only when present). */
export const jod = (n: number): string => `JOD ${nf.format(n)}`;

/** Compact form for headline tiles: JOD 4.53M, JOD 117.5K, JOD 6,000. */
export function jodShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 999_950) return `JOD ${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1000) return `JOD ${(n / 1e3).toFixed(1)}K`;
  return jod(n);
}

/** Ratio as a percentage; unavailable values (for example "Data missing") show as an em dash. */
export const pct = (v: number | string, digits = 0): string => (typeof v === "number" ? `${(v * 100).toFixed(digits)}%` : "—");

/** Signed percentage for growth: +10.0%, -6.3%. Unavailable values show as an em dash. */
export const signedPct = (v: number | string, digits = 1): string =>
  typeof v === "number" ? `${v >= 0 ? "+" : "-"}${Math.abs(v * 100).toFixed(digits)}%` : "—";

/** "18 Oct 2026" from an ISO date (YYYY-MM-DD). Anything else is returned unchanged. */
export function dayText(iso: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00Z`) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : iso;
}

/** "1 Jan – 18 Oct 2026": the year is shown once when both dates are in the same year. */
export function dateRange(from: string, to: string): string {
  const end = dayText(to);
  const start = dayText(from);
  return from.slice(0, 4) === to.slice(0, 4) && start !== from ? `${start.replace(/ \d{4}$/, "")} – ${end}` : `${start} – ${end}`;
}

/** Whole days, for ageing columns. */
export const daysText = (n: number | string): string => (typeof n === "number" ? `${Math.round(n)} d` : "—");
