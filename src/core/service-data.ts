/**
 * How fresh the service data is: the installed equipment file, machine details, contracts and contacts. Pure, so the app and
 * the demo word it the same way. The maintenance department is expected to keep it current every month.
 */
export const SERVICE_STALE_AFTER_DAYS = 35;

export type ServiceDataState = "never" | "fresh" | "stale";

const DAY = 86_400_000;
export const daysSinceUpdate = (lastUpdate: string, now: Date): number => Math.max(0, Math.floor((now.getTime() - new Date(lastUpdate).getTime()) / DAY));

export function serviceDataState(lastUpdate: string | null, now: Date): ServiceDataState {
  if (lastUpdate === null) return "never";
  return daysSinceUpdate(lastUpdate, now) > SERVICE_STALE_AFTER_DAYS ? "stale" : "fresh";
}

export function serviceDataText(lastUpdate: string | null, by: string | null, now: Date): string {
  if (lastUpdate === null) return "Nothing received yet";
  const d = daysSinceUpdate(lastUpdate, now);
  const when = d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
  return `Last update ${when}${by ? ` by ${by}` : ""}`;
}
