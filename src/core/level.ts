/**
 * The two versions of the owner's view, as in the demo. Basic keeps the company visible with the core screens; Advanced adds
 * the screens that need more records (tenders, installed equipment, service, support functions, the opportunity radar).
 * Pure. The choice is kept in a cookie. Nothing is lost by choosing Basic: the same data is loaded, only the extra screens are
 * left out of the menu. A person starts on Advanced, so nobody loses a screen they use today.
 *
 * The tender and finance departments always see the tender section: the version applies only to people with the business screens.
 */
import type { Role } from "./permissions";
import { canAccess } from "./permissions";

export const LEVELS = ["basic", "advanced"] as const;
export type Level = (typeof LEVELS)[number];
export const DEFAULT_LEVEL: Level = "advanced";
export const LEVEL_COOKIE = "sadaf_level";
export const LEVEL_LABEL: Record<Level, string> = { basic: "Basic", advanced: "Advanced" };

export function parseLevel(value: unknown): Level {
  return typeof value === "string" && (LEVELS as readonly string[]).includes(value) ? (value as Level) : DEFAULT_LEVEL;
}

/** Screens that belong to the Advanced version only. */
export const ADVANCED_ONLY = ["/tenders", "/installed-base", "/service", "/support-functions", "/opportunity-radar"] as const;

const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

export const isAdvancedOnly = (path: string): boolean => ADVANCED_ONLY.some((b) => under(path, b));

/** Whether a person on this version may see a screen: Basic hides the Advanced-only ones, except for department users, who only have the tender section. */
export function levelAllows(level: Level, role: Role, path: string): boolean {
  if (level === "advanced" || !isAdvancedOnly(path)) return true;
  return !canAccess(role, "business");
}

/** Whether the version switch is shown: only to people who have the business screens. */
export const showsLevelSwitch = (role: Role): boolean => canAccess(role, "business");

export const FEATURE_MATRIX: readonly (readonly [string, string, string])[] = [
  ["Owner priorities", "Sales, margin, cash, stock", "Adds repeat revenue and profit after costs"],
  ["Business lines", "Equipment / Devices / Consumables", "Same lines, linked across the account lifecycle"],
  ["Hidden losses", "Expiry estimates and overdue balances", "Adds delivery costs, low repeat purchases and service risk"],
  ["Tenders", "Review related booked sales and balances", "Ten stages, deadlines, guarantees, invoices and collection"],
  ["Installed equipment", "Not required to start", "Unit list, compatible consumables, usage and service contracts"],
  ["Opportunities", "Follow-up actions from known issues", "Repeat-purchase gaps, service contracts and equipment-age review"],
  ["Data effort", "Five ERP files + a few owner inputs", "Same ERP data + tender, service, unit and usage records"],
  ["Owner review", "Suggested 5–10 minutes daily", "Suggested 15–20 minutes weekly + daily exceptions"],
  ["Best fit", "Establish a simple reliable operating view", "Find causes across departments and repeat business"],
];
