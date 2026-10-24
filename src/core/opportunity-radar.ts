/**
 * Opportunity radar: where to look first for growth in the installed base. Pure.
 *
 * Three signals, each a reason to start a conversation and none a forecast:
 *   - low purchases: a customer buys clearly less consumables than its machines should use;
 *   - service: a machine with no contract, or one that is expiring;
 *   - older machines: installed five years ago or more.
 * The signals can point at the same customer, so the page never adds them into one opportunity value. Only the
 * consumables gap is money; the other two are counted in machines, because the app holds no contract price or
 * replacement cost.
 */
import type { InstalledBase, UnitInput } from "./installed-base";
import { ACTION_GROUPS, serviceGroup } from "./service-support";

export const OLD_UNIT_YEARS = 5;
/** A customer buying less than this share of its expected consumables is a low-purchase account. */
export const LOW_SHARE = 0.7;

export type RadarReason = "low_purchases" | "service" | "older";

export const REASON_LABEL: Record<RadarReason, string> = {
  low_purchases: "Buys less than its machines should use",
  service: "Service contract to sell or renew",
  older: `Machine installed ${OLD_UNIT_YEARS}+ years ago`,
};

/** Whole calendar years since the install date; null when it was not recorded or lies in the future. */
export function ageYears(installedOn: string | null, today: string): number | null {
  if (installedOn === null || installedOn > today) return null;
  const years = Number(today.slice(0, 4)) - Number(installedOn.slice(0, 4));
  // The anniversary has not come yet this year when today's month and day are earlier than the install's.
  return today.slice(5) < installedOn.slice(5) ? years - 1 : years;
}

export interface RadarAccount {
  customerCode: string;
  customerName: string;
  reasons: RadarReason[];
  /** Expected less bought per month; null without an estimate. */
  gapMonthly: number | null;
  share: number | null;
  /** The machines behind the service and age reasons. */
  units: { code: string; name: string; age: number | null; serviceFollowUp: boolean }[];
}

export interface Radar {
  signals: {
    /** Monthly gap across the customers that buy less than LOW_SHARE of their estimate. */
    repeatGapMonthly: number;
    repeatAccounts: number;
    serviceUnits: number;
    /** Machines with no recorded service status: a data gap, not counted as an opportunity. */
    serviceNotRecorded: number;
    olderUnits: number;
    /** Machines whose install date is missing, so their age is unknown. */
    ageNotRecorded: number;
  };
  accounts: RadarAccount[];
}

export function buildRadar(base: InstalledBase, today: string): Radar {
  let repeatGapMonthly = 0;
  let repeatAccounts = 0;
  let serviceUnits = 0;
  let serviceNotRecorded = 0;
  let olderUnits = 0;
  let ageNotRecorded = 0;
  const accounts: RadarAccount[] = [];

  for (const a of base.accounts) {
    const units = a.units.map((u: UnitInput) => ({
      code: u.code,
      name: u.name,
      age: ageYears(u.installedOn, today),
      group: serviceGroup(u, today),
    }));
    const low = a.share !== null && a.share < LOW_SHARE;
    const service = units.filter((u) => ACTION_GROUPS.includes(u.group));
    const older = units.filter((u) => u.age !== null && u.age >= OLD_UNIT_YEARS);
    if (low) {
      repeatAccounts += 1;
      repeatGapMonthly += a.gapMonthly ?? 0;
    }
    serviceUnits += service.length;
    serviceNotRecorded += units.filter((u) => u.group === "not_recorded").length;
    olderUnits += older.length;
    ageNotRecorded += units.filter((u) => u.age === null).length;

    const reasons: RadarReason[] = [...(low ? (["low_purchases"] as const) : []), ...(service.length > 0 ? (["service"] as const) : []), ...(older.length > 0 ? (["older"] as const) : [])];
    if (reasons.length === 0) continue;
    accounts.push({
      customerCode: a.customerCode,
      customerName: a.customerName,
      reasons,
      gapMonthly: a.gapMonthly,
      share: a.share,
      units: units
        .filter((u) => service.includes(u) || older.includes(u))
        .map((u) => ({ code: u.code, name: u.name, age: u.age, serviceFollowUp: service.includes(u) })),
    });
  }
  // The customers with the most reasons first, then the biggest consumables gap, then name.
  accounts.sort((x, y) => y.reasons.length - x.reasons.length || (y.gapMonthly ?? -1) - (x.gapMonthly ?? -1) || x.customerName.localeCompare(y.customerName));
  return { signals: { repeatGapMonthly, repeatAccounts, serviceUnits, serviceNotRecorded, olderUnits, ageNotRecorded }, accounts };
}
