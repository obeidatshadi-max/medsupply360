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
