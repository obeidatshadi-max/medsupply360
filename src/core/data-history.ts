/**
 * Plain-English wording for the "Update history" list: what each recorded action means. Pure, so the app and the demo
 * show the same sentence for the same action.
 */
import { SPECS, type ImportKind } from "@/core/import/specs";
import { STATUS_LABEL, type TenderStatus } from "@/core/tender-flow";

/** The audit actions that count as someone entering or changing data. Everything else (sign-ins, account changes) is not listed. */
export const DATA_ACTIONS = [
  "tender.created",
  "tender.updated",
  "tender.moved",
  "tender.guarantee_added",
  "tender.guarantee_updated",
  "tender.guarantee_deleted",
  "tender.invoice_added",
  "tender.invoice_deleted",
  "tender.payment_recorded",
  "import.run",
  "support.indicator_added",
  "support.indicator_updated",
  "support.indicator_deleted",
  "support.reading_recorded",
  "profile.updated",
  "mgmt_action.added",
  "mgmt_action.completed",
  "mgmt_action.reopened",
  "mgmt_action.removed",
] as const;
export type DataAction = (typeof DATA_ACTIONS)[number];

export const isDataAction = (a: string): a is DataAction => (DATA_ACTIONS as readonly string[]).includes(a);

export type HistoryArea = "Tenders" | "Uploads" | "Support functions" | "Company profile" | "Management actions";
export const areaOf = (a: DataAction): HistoryArea => (a === "import.run" ? "Uploads" : a.startsWith("support.") ? "Support functions" : a === "profile.updated" ? "Company profile" : a.startsWith("mgmt_action.") ? "Management actions" : "Tenders");

const status = (v: unknown) => (typeof v === "string" && v in STATUS_LABEL ? STATUS_LABEL[v as TenderStatus] : null);
const num = (v: unknown) => (typeof v === "number" ? v : null);
/** " (name)" for a detail that is a non-empty string, else nothing. */
const text = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? ` (${v})` : "");

/** One short sentence for a recorded action. Unknown details fall back to the general wording, never to a blank. */
export function describeAction(action: DataAction, details: Record<string, unknown> | null | undefined): string {
  const d = details ?? {};
  switch (action) {
    case "tender.created":
      return "Recorded a new tender";
    case "tender.updated":
      return "Changed tender details";
    case "tender.moved": {
      const from = status(d.from);
      const to = status(d.to);
      return from && to ? `Moved a tender from ${from} to ${to}` : "Moved a tender to a new stage";
    }
    case "tender.guarantee_added":
      return d.kind === "performance" ? "Added a performance guarantee" : d.kind === "bid" ? "Added a bid guarantee" : "Added a guarantee";
    case "tender.guarantee_updated":
      return "Changed a guarantee";
    case "tender.guarantee_deleted":
      return "Removed a guarantee";
    case "tender.invoice_added":
      return "Added an invoice";
    case "tender.invoice_deleted":
      return "Removed an invoice";
    case "tender.payment_recorded":
      return typeof d.collected === "string" && d.collected !== "" ? `Recorded a payment (total collected ${d.collected})` : "Recorded a payment";
    case "support.indicator_added":
      return `Added a support indicator${text(d.name)}`;
    case "support.indicator_updated":
      return `Changed a support indicator${text(d.name)}`;
    case "support.indicator_deleted":
      return `Removed a support indicator${text(d.name)}`;
    case "support.reading_recorded": {
      const value = text(d.reading);
      return `Recorded a reading${text(d.name)}${value ? `: ${d.reading}` : ""}`;
    }
    case "mgmt_action.added":
      return `Added a management action${text(d.title)}`;
    case "mgmt_action.completed":
      return `Marked a management action done${text(d.title)}`;
    case "mgmt_action.reopened":
      return `Reopened a management action${text(d.title)}`;
    case "mgmt_action.removed":
      return `Removed a management action${text(d.title)}`;
    case "profile.updated":
      return "Changed the company profile";
    case "import.run": {
      const spec = typeof d.kind === "string" && d.kind in SPECS ? SPECS[d.kind as ImportKind].title : "a file";
      const rows = num(d.rowsAccepted);
      return `Imported ${spec}${typeof d.fileName === "string" ? ` (${d.fileName})` : ""}${rows === null ? "" : `: ${rows} row${rows === 1 ? "" : "s"} loaded`}`;
    }
  }
}
