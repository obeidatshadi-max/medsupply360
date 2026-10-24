/**
 * The life of one tender, from "we heard a hospital will buy" to "the money is in". Pure rules, shared by the screens,
 * the server actions and the tests. The ten stages and their suggested statuses come from the department's own list;
 * "Award decision" ends in Won, Lost or Cancelled.
 */

export const AUTHORITIES = [
  { code: "MOH", name: "Ministry of Health" },
  { code: "KHCC", name: "King Hussein Cancer Center" },
  { code: "DRMS", name: "Royal Medical Services" },
  { code: "JUH", name: "Jordan University Hospital" },
  { code: "KAUH", name: "King Abdullah University Hospital" },
] as const;
export type AuthorityCode = (typeof AUTHORITIES)[number]["code"];
export const isAuthority = (v: string): v is AuthorityCode => AUTHORITIES.some((a) => a.code === v);

export const PRODUCT_LINES = ["equipment", "consumables", "mixed"] as const;
export type TenderLine = (typeof PRODUCT_LINES)[number];
export const LINE_LABEL: Record<TenderLine, string> = { equipment: "Equipment", consumables: "Consumables", mixed: "Equipment and consumables" };

export const STATUSES = [
  "pipeline",
  "open",
  "preparing",
  "submitted",
  "technical_review",
  "financial_review",
  "won",
  "lost",
  "cancelled",
  "contracted",
  "delivered",
  "collected",
] as const;
export type TenderStatus = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<TenderStatus, string> = {
  pipeline: "Pipeline",
  open: "Open",
  preparing: "Preparing",
  submitted: "Submitted",
  technical_review: "Technical review",
  financial_review: "Financial review",
  won: "Won",
  lost: "Lost",
  cancelled: "Cancelled",
  contracted: "Contracted",
  delivered: "Delivered",
  collected: "Collected",
};

/** Stage number and main action from the department's list (Won, Lost and Cancelled share stage 7). */
export const STAGE: Record<TenderStatus, { no: number; name: string; action: string }> = {
  pipeline: { no: 1, name: "Opportunity identification", action: "Identify expected hospital or government purchasing needs" },
  open: { no: 2, name: "Tender announced", action: "Record tender number, institution, value and deadline" },
  preparing: { no: 3, name: "Bid preparation", action: "Prepare technical specifications, registration documents, pricing and guarantees" },
  submitted: { no: 4, name: "Bid submitted", action: "Submit the completed offer" },
  technical_review: { no: 5, name: "Technical evaluation", action: "Review specification compliance, documentation, and any samples or demonstrations required" },
  financial_review: { no: 6, name: "Financial evaluation", action: "Evaluate commercial offers according to the tender's stated criteria" },
  won: { no: 7, name: "Award decision", action: "Record successful bidder, award amount, objections or cancellation where relevant" },
  lost: { no: 7, name: "Award decision", action: "Record the reason the bid was not successful" },
  cancelled: { no: 7, name: "Award decision", action: "Record why the tender was cancelled or dropped" },
  contracted: { no: 8, name: "Contract / PO", action: "Finalize the contract, purchase order and required guarantees" },
  delivered: { no: 9, name: "Delivery", action: "Supply equipment or consumables, install where applicable, and obtain acceptance" },
  collected: { no: 10, name: "Payment collection", action: "Invoice, follow receivables and collect outstanding payments" },
};

/** Four phases for the owner's overview. Lost and cancelled tenders leave the phases and are counted as closed. */
export const PHASES = [
  { key: "before_bidding", label: "Before bidding" },
  { key: "in_evaluation", label: "Bid in evaluation" },
  { key: "award_contract", label: "Award and contract" },
  { key: "delivery_payment", label: "Delivery and payment" },
] as const;
export type PhaseKey = (typeof PHASES)[number]["key"] | "closed";

export function phaseOf(status: TenderStatus): PhaseKey {
  switch (status) {
    case "pipeline":
    case "open":
    case "preparing":
      return "before_bidding";
    case "submitted":
    case "technical_review":
    case "financial_review":
      return "in_evaluation";
    case "won":
    case "contracted":
      return "award_contract";
    case "delivered":
    case "collected":
      return "delivery_payment";
    case "lost":
    case "cancelled":
      return "closed";
  }
}

/** Where a tender may go next. A tender can be cancelled until it is delivered; lost only after the bid was reviewed. */
const FORWARD: Record<TenderStatus, readonly TenderStatus[]> = {
  pipeline: ["open", "cancelled"],
  open: ["preparing", "cancelled"],
  preparing: ["submitted", "cancelled"],
  submitted: ["technical_review", "cancelled"],
  technical_review: ["financial_review", "lost", "cancelled"],
  financial_review: ["won", "lost", "cancelled"],
  won: ["contracted", "cancelled"],
  contracted: ["delivered"],
  delivered: ["collected"],
  lost: [],
  cancelled: [],
  collected: [],
};

/** One step back to fix a mistake. Lost and cancelled are final: a reopened tender is entered again. */
const BACK: Partial<Record<TenderStatus, TenderStatus>> = {
  open: "pipeline",
  preparing: "open",
  submitted: "preparing",
  technical_review: "submitted",
  financial_review: "technical_review",
  won: "financial_review",
  contracted: "won",
  delivered: "contracted",
  collected: "delivered",
};

export const forwardMoves = (from: TenderStatus): readonly TenderStatus[] => FORWARD[from];
export const backMove = (from: TenderStatus): TenderStatus | null => BACK[from] ?? null;

export function isLegalMove(from: TenderStatus, to: TenderStatus): boolean {
  return FORWARD[from].includes(to) || BACK[from] === to;
}

export const isClosed = (s: TenderStatus): boolean => s === "lost" || s === "cancelled" || s === "collected";

/** Coded reasons a tender ends as Lost or Cancelled, so losses can be counted. The free-text note stays beside the code. */
export const CLOSE_REASONS = [
  { code: "price", label: "Our price was higher", for: ["lost"] },
  { code: "technical", label: "Did not meet the technical specification", for: ["lost"] },
  { code: "documents", label: "Documents or registration missing or late", for: ["lost"] },
  { code: "guarantee", label: "Guarantee problem", for: ["lost"] },
  { code: "authority_cancelled", label: "The authority cancelled or withdrew the tender", for: ["cancelled"] },
  { code: "no_budget", label: "The authority has no budget", for: ["cancelled"] },
  { code: "not_bidding", label: "We decided not to bid", for: ["cancelled"] },
  { code: "other", label: "Other (explain in the note)", for: ["lost", "cancelled"] },
] as const;
export type CloseReasonCode = (typeof CLOSE_REASONS)[number]["code"];
export const isCloseReason = (v: string): v is CloseReasonCode => CLOSE_REASONS.some((r) => r.code === v);
export const closeReasonLabel = (code: string | null): string | null => CLOSE_REASONS.find((r) => r.code === code)?.label ?? null;
/** The reasons offered when ending a tender as `to` (lost or cancelled). */
export const closeReasonsFor = (to: TenderStatus) => CLOSE_REASONS.filter((r) => (r.for as readonly string[]).includes(to));

/** The fields a tender carries. Money is JOD; dates are YYYY-MM-DD. */
export interface TenderFields {
  tenderNo: string | null;
  estimatedValue: number | null;
  deadline: string | null;
  bidValue: number | null;
  awardAmount: number | null;
  closeReason: string | null;
  closeReasonCode: string | null;
  /** Who won, and at what price, when we lost. Optional: not every authority publishes them. */
  winnerName: string | null;
  winningPrice: number | null;
  /** When the authority is expected to announce the award. Optional. */
  expectedAwardDate: string | null;
  contractNo: string | null;
  contractValue: number | null;
  deliveredOn: string | null;
}

const NEEDED: Partial<Record<TenderStatus, { key: keyof TenderFields; label: string }[]>> = {
  open: [
    { key: "tenderNo", label: "tender number" },
    { key: "estimatedValue", label: "estimated value" },
    { key: "deadline", label: "submission deadline" },
  ],
  submitted: [{ key: "bidValue", label: "bid value" }],
  won: [{ key: "awardAmount", label: "award amount" }],
  lost: [{ key: "closeReasonCode", label: "reason it was lost" }],
  cancelled: [{ key: "closeReasonCode", label: "reason it was cancelled or dropped" }],
  contracted: [
    { key: "contractNo", label: "contract or PO number" },
    { key: "contractValue", label: "contract value" },
  ],
  delivered: [{ key: "deliveredOn", label: "delivery date" }],
};

/** Details worth asking for on a move but never required. */
const OPTIONAL: Partial<Record<TenderStatus, { key: keyof TenderFields; label: string }[]>> = {
  submitted: [{ key: "expectedAwardDate", label: "expected award date" }],
  lost: [
    { key: "winnerName", label: "winning company" },
    { key: "winningPrice", label: "winning price" },
  ],
};
export const optionalFor = (to: TenderStatus): readonly { key: keyof TenderFields; label: string }[] => OPTIONAL[to] ?? [];

/** The fields a tender must have before it may enter `to`, so a move form can ask for exactly those. */
export const neededFor = (to: TenderStatus): readonly { key: keyof TenderFields; label: string }[] => NEEDED[to] ?? [];

const filled = (v: unknown): boolean => v !== null && v !== undefined && !(typeof v === "string" && v.trim() === "");

/** What is still missing before a tender may enter `to`. Moving backwards never asks for anything. */
export function missingFor(to: TenderStatus, fields: TenderFields, from?: TenderStatus): string[] {
  if (from && BACK[from] === to) return [];
  const missing = (NEEDED[to] ?? []).filter((n) => !filled(fields[n.key])).map((n) => n.label);
  if (fields.closeReasonCode === "other" && (to === "lost" || to === "cancelled") && !filled(fields.closeReason)) missing.push("a note explaining the reason");
  return missing;
}

/** Why a reason code cannot be used when ending a tender as `to`, or null. An empty code is `missingFor`'s business. */
export function closeReasonProblem(to: TenderStatus, code: string | null): string | null {
  if (to !== "lost" && to !== "cancelled") return null;
  if (!filled(code)) return null;
  if (!isCloseReason(code!)) return "That reason is not one of the listed reasons.";
  if (!closeReasonsFor(to).some((r) => r.code === code)) return `"${closeReasonLabel(code)}" does not fit a tender that is ${STATUS_LABEL[to].toLowerCase()}.`;
  return null;
}

/** Whole days a tender has been in its current status. Never negative. */
export function daysInStage(since: string | Date, today: string): number {
  const start = typeof since === "string" ? Date.parse(since) : since.getTime();
  const end = Date.parse(`${today}T23:59:59Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}
