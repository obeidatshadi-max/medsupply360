/**
 * The installed base: equipment sitting at customers, and whether those customers buy the consumables it should use.
 * Pure, so the page and its tests share one set of rules.
 *
 * The comparison is made per customer, never per machine: sales are recorded against the customer, so when one customer
 * holds three analyzers only their combined expected use can be set against what the customer bought. A customer with no
 * estimate on any unit is listed but left out of every total, so the totals compare like with like. The gap is an
 * investigation prompt, not a loss claim.
 */

export type ServiceStatus = "Active" | "Expiring" | "No contract";

export interface UnitInput {
  code: string;
  /** The business line of the machine's product; null when the unit has no product on the list. */
  line?: "Equipment" | "Devices" | "Consumables" | null;
  /** The product on the list this machine is, when there is one. */
  productCode?: string | null;
  /** "erp" = taken from the imported sales (warranty and service not known); "manual" = described by the owner. */
  source?: "erp" | "manual";
  name: string;
  customerCode: string;
  customerName: string;
  installedOn: string | null;
  warrantyEnd: string | null;
  service: ServiceStatus | null;
  /** JOD a month the unit should use in consumables. Null = nobody estimated it. */
  expectedMonthly: number | null;
}

export interface UnitFlag {
  kind: "warranty_ended" | "warranty_soon" | "service";
  text: string;
}

export interface AccountRow {
  customerCode: string;
  customerName: string;
  units: (UnitInput & { flags: UnitFlag[] })[];
  /** What the customer should buy a month: the owner's estimates added up, or else the customer's own earlier norm; null when neither exists. */
  expectedMonthly: number | null;
  /** Where `expectedMonthly` comes from: "typed" (owner's estimates), "history" (the customer's earlier purchases), or null. */
  expectedSource: "typed" | "history" | null;
  /** What the customer bought in consumables per month over the window. */
  actualMonthly: number;
  /** actual / expected; null without an estimate. Above 1 means the customer buys more than estimated. */
  share: number | null;
  /** Expected less actual, never below zero. Null without an estimate. */
  gapMonthly: number | null;
}

export interface InstalledBase {
  accounts: AccountRow[];
  totals: {
    units: number;
    customers: number;
    /** Customers that have an estimate: the only ones the three money totals cover. */
    customersWithEstimate: number;
    expectedMonthly: number;
    actualMonthly: number;
    gapMonthly: number;
    unitsWithoutEstimate: number;
  };
  /** Units whose warranty has ended or ends within the window, or that are out of warranty with no service contract. */
  attention: { unit: UnitInput; customerName: string; flags: UnitFlag[] }[];
}

export const WARRANTY_SOON_DAYS = 90;

const DAY = 86_400_000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

export function unitFlags(u: UnitInput, today: string): UnitFlag[] {
  const flags: UnitFlag[] = [];
  const left = u.warrantyEnd === null ? null : daysBetween(today, u.warrantyEnd);
  if (left !== null && left < 0) {
    flags.push({ kind: "warranty_ended", text: "Warranty ended" });
    if (u.service === "No contract" || u.service === null) flags.push({ kind: "service", text: "No service contract" });
  } else if (left !== null && left <= WARRANTY_SOON_DAYS) {
    flags.push({ kind: "warranty_soon", text: `Warranty ends in ${left} day${left === 1 ? "" : "s"}` });
  }
  if (u.service === "Expiring") flags.push({ kind: "service", text: "Service contract expiring" });
  return flags;
}

/** `consumablesByCustomer`: average consumables bought per month, by customer code (missing = bought nothing). */
export function buildInstalledBase(units: UnitInput[], consumablesByCustomer: ReadonlyMap<string, number>, today: string, earlierNorm: ReadonlyMap<string, number> = new Map()): InstalledBase {
  const byCustomer = new Map<string, UnitInput[]>();
  for (const u of units) byCustomer.set(u.customerCode, [...(byCustomer.get(u.customerCode) ?? []), u]);

  const accounts: AccountRow[] = [...byCustomer.values()].map((list) => {
    const estimated = list.filter((u) => u.expectedMonthly !== null);
    const norm = earlierNorm.get(list[0]!.customerCode);
    const typed = estimated.length === 0 ? null : estimated.reduce((s, u) => s + u.expectedMonthly!, 0);
    // The owner's own estimate wins; without one, the customer's earlier purchases set the norm.
    const expectedMonthly = typed ?? norm ?? null;
    const expectedSource: AccountRow["expectedSource"] = typed !== null ? "typed" : norm !== undefined ? "history" : null;
    const actualMonthly = consumablesByCustomer.get(list[0]!.customerCode) ?? 0;
    return {
      customerCode: list[0]!.customerCode,
      customerName: list[0]!.customerName,
      units: list.map((u) => ({ ...u, flags: unitFlags(u, today) })),
      expectedMonthly,
      expectedSource,
      actualMonthly,
      share: expectedMonthly === null || expectedMonthly <= 0 ? null : actualMonthly / expectedMonthly,
      gapMonthly: expectedMonthly === null ? null : Math.max(0, expectedMonthly - actualMonthly),
    };
  });
  // The biggest gap first; customers without an estimate last, by name.
  accounts.sort((a, b) => (b.gapMonthly ?? -1) - (a.gapMonthly ?? -1) || a.customerName.localeCompare(b.customerName));

  const covered = accounts.filter((a) => a.expectedMonthly !== null);
  return {
    accounts,
    totals: {
      units: units.length,
      customers: accounts.length,
      customersWithEstimate: covered.length,
      expectedMonthly: covered.reduce((s, a) => s + a.expectedMonthly!, 0),
      actualMonthly: covered.reduce((s, a) => s + a.actualMonthly, 0),
      gapMonthly: covered.reduce((s, a) => s + a.gapMonthly!, 0),
      // Machines at a customer for whom there is no expectation at all (no typed estimate and no earlier norm).
      unitsWithoutEstimate: accounts.filter((a) => a.expectedMonthly === null).reduce((n, a) => n + a.units.length, 0),
    },
    attention: accounts.flatMap((a) => a.units.filter((u) => u.flags.length > 0).map((u) => ({ unit: u, customerName: a.customerName, flags: u.flags }))),
  };
}

/** What winning back part of the monthly gap is worth over a year. Both inputs are shares between 0 and 1. */
export function recoveryScenario(gapMonthly: number, recoverShare: number, margin: number) {
  const share = Math.min(1, Math.max(0, recoverShare));
  const m = Math.min(1, Math.max(0, margin));
  const annualRevenue = gapMonthly * share * 12;
  return { annualRevenue, annualProfit: annualRevenue * m };
}
