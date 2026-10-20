/**
 * Service coverage of the installed equipment: which machines are under a service contract and which are a service
 * opportunity. Pure. It uses only what is recorded on the equipment list (service status and warranty end). It says
 * nothing about uptime or usage, because the app holds no service events or operating hours.
 */
import { WARRANTY_SOON_DAYS, type UnitInput } from "./installed-base";

export const SERVICE_GROUPS = [
  "out_of_warranty_uncovered",
  "contract_expiring",
  "warranty_ending_uncovered",
  "in_warranty_uncovered",
  "uncovered_date_unknown",
  "not_recorded",
  "covered",
] as const;
export type ServiceGroup = (typeof SERVICE_GROUPS)[number];

export const GROUP_LABEL: Record<ServiceGroup, string> = {
  out_of_warranty_uncovered: "Out of warranty, no contract",
  contract_expiring: "Contract expiring",
  warranty_ending_uncovered: "Warranty ending soon, no contract",
  in_warranty_uncovered: "In warranty, no contract yet",
  uncovered_date_unknown: "No contract, warranty date not recorded",
  not_recorded: "Service status not recorded",
  covered: "Under contract",
};

/** Groups that are a follow-up for the owner: a contract to sell or renew. */
export const ACTION_GROUPS: readonly ServiceGroup[] = ["out_of_warranty_uncovered", "contract_expiring", "warranty_ending_uncovered", "in_warranty_uncovered", "uncovered_date_unknown"];

const DAY = 86_400_000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

export function serviceGroup(u: Pick<UnitInput, "service" | "warrantyEnd">, today: string): ServiceGroup {
  if (u.service === "Active") return "covered";
  if (u.service === "Expiring") return "contract_expiring";
  if (u.service === null) return "not_recorded";
  // "No contract": where it falls depends on the warranty.
  if (u.warrantyEnd === null) return "uncovered_date_unknown";
  const left = daysBetween(today, u.warrantyEnd);
  if (left < 0) return "out_of_warranty_uncovered";
  return left <= WARRANTY_SOON_DAYS ? "warranty_ending_uncovered" : "in_warranty_uncovered";
}

export interface ServiceRow {
  unit: UnitInput;
  group: ServiceGroup;
  /** Days to the warranty end; negative once it has ended; null when unknown. */
  warrantyDays: number | null;
}

export interface ServiceView {
  rows: ServiceRow[];
  counts: Record<ServiceGroup, number>;
  totals: {
    units: number;
    underContract: number;
    /** Units under an active contract as a share of all units; null with no units. */
    coverage: number | null;
    /** Units that are a contract to sell or renew. */
    toFollowUp: number;
    notRecorded: number;
  };
}

export function buildServiceView(units: UnitInput[], today: string): ServiceView {
  const rows: ServiceRow[] = units.map((unit) => ({
    unit,
    group: serviceGroup(unit, today),
    warrantyDays: unit.warrantyEnd === null ? null : daysBetween(today, unit.warrantyEnd),
  }));
  // Most urgent group first; inside a group the earliest warranty end, then customer and machine.
  rows.sort(
    (a, b) =>
      SERVICE_GROUPS.indexOf(a.group) - SERVICE_GROUPS.indexOf(b.group) ||
      (a.warrantyDays ?? Infinity) - (b.warrantyDays ?? Infinity) ||
      a.unit.customerName.localeCompare(b.unit.customerName) ||
      a.unit.code.localeCompare(b.unit.code),
  );
  const counts = Object.fromEntries(SERVICE_GROUPS.map((g) => [g, rows.filter((r) => r.group === g).length])) as Record<ServiceGroup, number>;
  return {
    rows,
    counts,
    totals: {
      units: rows.length,
      underContract: counts.covered,
      coverage: rows.length === 0 ? null : counts.covered / rows.length,
      toFollowUp: ACTION_GROUPS.reduce((s, g) => s + counts[g], 0),
      notRecorded: counts.not_recorded,
    },
  };
}
