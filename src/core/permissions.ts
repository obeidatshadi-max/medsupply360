/**
 * Who may open which part of the app. Pure and shared by the sidebar, the page guards and the Settings actions, so the
 * rules live in one place.
 *
 *   owner    the CEO: everything, including Settings and importing ERP files.
 *   admin    reads the business screens and the tender section; no Settings, no import.
 *   viewer   reads the business screens only.
 *   tender   the tender department: the tender section only.
 *   finance  the finance staff who fill guarantees and payments on tenders: the tender section only.
 *   maintenance  the service department: the installed machines and service screens, and the equipment file; no sales, profit or tenders.
 */
import type { TenderStatus } from "@/core/tender-flow";
import type { ImportKind } from "@/core/import/specs";

export const ROLES = ["owner", "admin", "viewer", "tender", "finance", "maintenance"] as const;
export type Role = (typeof ROLES)[number];

export type Area = "business" | "tender" | "settings" | "service" | "deals";

const ACCESS: Record<Role, readonly Area[]> = {
  owner: ["business", "tender", "settings", "service", "deals"],
  admin: ["business", "tender", "service", "deals"],
  viewer: ["business", "service"],
  tender: ["tender"],
  finance: ["tender", "deals"],
  maintenance: ["service"],
};

export const canAccess = (role: Role, area: Area): boolean => ACCESS[role].includes(area);

/** Where a signed-in user lands: the first area they may open. */
export const homePath = (role: Role): string => (canAccess(role, "business") ? "/dashboard" : canAccess(role, "tender") ? "/tenders" : "/installed-base");

/** Roles the owner may give to other people in Settings. The owner role is never handed out there. */
export const ASSIGNABLE_ROLES = ["admin", "viewer", "tender", "finance", "maintenance"] as const satisfies readonly Role[];
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const isAssignableRole = (value: string): value is AssignableRole => (ASSIGNABLE_ROLES as readonly string[]).includes(value);

export const ROLE_LABEL: Record<Role, { name: string; note: string }> = {
  owner: { name: "Owner", note: "Everything, including Settings and importing files" },
  admin: { name: "Administrator", note: "All business screens and tenders; cannot import or change users" },
  viewer: { name: "Viewer", note: "Reads the business screens only" },
  tender: { name: "Tender department", note: "Tender section only; updates tender stages and uploads the tender list and tender results" },
  finance: { name: "Finance", note: "Tender section and Deal margins only; updates guarantees and payments, and enters deal costs, rebates and cost reviews. Cannot set company limits or start actions" },
  maintenance: { name: "Maintenance", note: "Installed base and Service screens only (they show each customer's consumables spending); uploads the equipment file and adds machine details, contracts and contacts. No sales, profit or tenders" },
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

/** The only file types the tender department may upload: its own tender list and the award results. */
export const TENDER_UPLOAD_KINDS = ["tenders", "tender_results"] as const satisfies readonly ImportKind[];

/**
 * Who may upload a file of this type. The owner may upload any type. The tender department may upload only the tender list
 * and tender results (never ERP files, sales force or machines), and a file never moves a tender's stage.
 */
export function canImportKind(role: Role, kind: ImportKind): boolean {
  if (role === "owner") return true;
  if (role === "maintenance") return (MAINTENANCE_UPLOAD_KINDS as readonly string[]).includes(kind);
  return role === "tender" && (TENDER_UPLOAD_KINDS as readonly string[]).includes(kind);
}

/** The only file type the maintenance department may upload: the installed equipment list with its contracts and contacts. */
export const MAINTENANCE_UPLOAD_KINDS = ["installed_units"] as const satisfies readonly ImportKind[];

/** Whether the person may open the equipment upload page, and add machine details by hand. */
export const canUploadEquipment = (role: Role): boolean => role === "owner" || role === "maintenance";

/** Whether the person may open the tender upload page at all. */
export const canUploadTenders = (role: Role): boolean => role === "owner" || role === "tender";

/** Who keeps the sales force and assigns products, accounts and tenders to it: the CEO. */
export const canManageSalesForce = (role: Role): boolean => role === "owner";

/** Who may read the Sales force page (emails, targets, who holds what): the owner and administrators. */
export const canSeeSalesForce = (role: Role): boolean => role === "owner" || role === "admin";

/** Who adds, finishes and removes management actions: the owner and administrators. Everyone with business access reads them. */
export const canManageActions = (role: Role): boolean => role === "owner" || role === "admin";

/** Who writes the company profile: the CEO. Everyone with business access reads it. */
export const canEditProfile = (role: Role): boolean => role === "owner";

/** Who defines the support indicators and records their readings: the CEO. Everyone with business access reads them. */
export const canManageSupport = (role: Role): boolean => role === "owner";

/** Who may read the Update history: the owner and administrators. Department staff see their own tender's history only. */
export const canSeeHistory = (role: Role): boolean => role === "owner" || role === "admin";

/** Guarantees are prepared with the bid (tender department) and issued and returned by finance. */
export const canEditGuarantees = (role: Role): boolean => role === "owner" || role === "tender" || role === "finance";

/**
 * Deal margins show what each deal really earns, cost by cost. The owner, administrators and finance read them (they are
 * the company's most sensitive figures). The owner and finance keep the data: they add deals, enter costs and rebates, import
 * the cost file and confirm or reject uncertain matches. Only the owner sets the approved limits and starts or checks
 * management actions, because those are company decisions. The pre-bid simulator is open to everyone who can read deal
 * margins and never writes anything.
 */
export const canSeeDealMargin = (role: Role): boolean => canAccess(role, "deals");
export const canEditDealMargin = (role: Role): boolean => role === "owner" || role === "finance";
export const canSetDealLimits = (role: Role): boolean => role === "owner";
export const canDecideDealActions = (role: Role): boolean => role === "owner";
export const canSimulateDeal = (role: Role): boolean => canSeeDealMargin(role);

/** Invoices and the money collected on them belong to finance. */
export const canEditPayments = (role: Role): boolean => role === "owner" || role === "finance";
