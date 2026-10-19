/**
 * Checks a hand-entered tender invoice against the ERP files by invoice number. The tender tracker stays the owner's own
 * record; this only says whether the ERP agrees about what is still unpaid.
 */

export interface ErpInvoiceFacts {
  /** The invoice number exists in the imported sales or unpaid-invoice files. */
  found: boolean;
  /** Date of the company's newest unpaid-invoice file, or null when none was imported. */
  snapshotDate: string | null;
  /** Amount still unpaid on that date, or null when the invoice is not listed in that file. */
  remaining: number | null;
}

export type ErpCheck =
  | { kind: "not-found" }
  | { kind: "no-snapshot" }
  | { kind: "agrees"; remaining: number; snapshotDate: string }
  | { kind: "differs"; remaining: number; snapshotDate: string };

const fils = (n: number) => Math.round(n * 1000);

/** `unpaid` is what the tender record says is still unpaid on this invoice. */
export function checkAgainstErp(unpaid: number, erp: ErpInvoiceFacts | undefined): ErpCheck {
  if (!erp || !erp.found) return { kind: "not-found" };
  if (erp.snapshotDate === null) return { kind: "no-snapshot" };
  // An invoice missing from the newest unpaid file is fully paid as far as the ERP is concerned.
  const remaining = erp.remaining ?? 0;
  return { kind: fils(remaining) === fils(unpaid) ? "agrees" : "differs", remaining, snapshotDate: erp.snapshotDate };
}
