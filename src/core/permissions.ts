/**
 * Who may open which part of the app. Pure and shared by the sidebar, the page guards and the Settings actions, so the
 * rules live in one place.
 *
 *   owner    the CEO: everything, including Settings and importing ERP files.
 *   admin    reads the business screens and the tender section; no Settings, no import.
 *   viewer   reads the business screens only.
 *   tender   the tender department: the tender section only.
 *   finance  the finance staff who fill guarantees and payments on tenders: the tender section only.
 */
import type { TenderStatus } from "@/core/tender-flow";

export const ROLES = ["owner", "admin", "viewer", "tender", "finance"] as const;
export type Role = (typeof ROLES)[number];

export type Area = "business" | "tender" | "settings";

const ACCESS: Record<Role, readonly Area[]> = {
  owner: ["business", "tender", "settings"],
  admin: ["business", "tender"],
  viewer: ["business"],
  tender: ["tender"],
  finance: ["tender"],
};

export const canAccess = (role: Role, area: Area): boolean => ACCESS[role].includes(area);

/** Where a signed-in user lands: the first area they may open. */
export const homePath = (role: Role): string => (canAccess(role, "business") ? "/dashboard" : "/tenders");

/** Roles the owner may give to other people in Settings. The owner role is never handed out there. */
export const ASSIGNABLE_ROLES = ["admin", "viewer", "tender", "finance"] as const satisfies readonly Role[];
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const isAssignableRole = (value: string): value is AssignableRole => (ASSIGNABLE_ROLES as readonly string[]).includes(value);

export const ROLE_LABEL: Record<Role, { name: string; note: string }> = {
  owner: { name: "Owner", note: "Everything, including Settings and importing files" },
  admin: { name: "Administrator", note: "All business screens and tenders; cannot import or change users" },
  viewer: { name: "Viewer", note: "Reads the business screens only" },
  tender: { name: "Tender department", note: "Tender section only; updates tender stages" },
  finance: { name: "Finance", note: "Tender section only; updates guarantees and payments" },
};

/**
 * Who may change tenders. The tender department enters and moves a tender through every stage up to delivery; finance
 * takes over once goods are delivered (payment collection). The owner can do both. Everyone else with tender access
 * (administrator) only reads.
 */
export const canEditTender = (role: Role): boolean => role === "owner" || role === "tender";

export function canMoveTender(role: Role, from: TenderStatus, to: TenderStatus): boolean {
  const collection = from === "collected" || to === "collected";
  if (role === "owner") return true;
  if (role === "tender") return !collection;
  if (role === "finance") return collection;
  return false;
}

/** Who keeps the sales force and assigns products, accounts and tenders to it: the CEO. */
export const canManageSalesForce = (role: Role): boolean => role === "owner";

/** Who may read the Sales force page (emails, targets, who holds what): the owner and administrators. */
export const canSeeSalesForce = (role: Role): boolean => role === "owner" || role === "admin";

/** Who writes the company profile: the CEO. Everyone with business access reads it. */
export const canEditProfile = (role: Role): boolean => role === "owner";

/** Who defines the support indicators and records their readings: the CEO. Everyone with business access reads them. */
export const canManageSupport = (role: Role): boolean => role === "owner";

/** Who may read the Update history: the owner and administrators. Department staff see their own tender's history only. */
export const canSeeHistory = (role: Role): boolean => role === "owner" || role === "admin";

/** Guarantees are prepared with the bid (tender department) and issued and returned by finance. */
export const canEditGuarantees = (role: Role): boolean => role === "owner" || role === "tender" || role === "finance";

/** Invoices and the money collected on them belong to finance. */
export const canEditPayments = (role: Role): boolean => role === "owner" || role === "finance";
