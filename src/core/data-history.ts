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
] as const;
export type DataAction = (typeof DATA_ACTIONS)[number];

export const isDataAction = (a: string): a is DataAction => (DATA_ACTIONS as readonly string[]).includes(a);

export type HistoryArea = "Tenders" | "ERP import";
export const areaOf = (a: DataAction): HistoryArea => (a === "import.run" ? "ERP import" : "Tenders");

const status = (v: unknown) => (typeof v === "string" && v in STATUS_LABEL ? STATUS_LABEL[v as TenderStatus] : null);
const num = (v: unknown) => (typeof v === "number" ? v : null);

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
    case "import.run": {
      const spec = typeof d.kind === "string" && d.kind in SPECS ? SPECS[d.kind as ImportKind].title : "a file";
      const rows = num(d.rowsAccepted);
      return `Imported ${spec}${typeof d.fileName === "string" ? ` (${d.fileName})` : ""}${rows === null ? "" : `: ${rows} row${rows === 1 ? "" : "s"} loaded`}`;
    }
  }
}
