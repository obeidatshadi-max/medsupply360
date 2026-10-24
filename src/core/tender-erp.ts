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
  /** The ERP invoice's own date, its contractual due date (null until the ERP supplies one), the customer and the net sales (before tax). */
  invoiceDate: string | null;
  dueDate: string | null;
  customerName: string | null;
  netSales: number | null;
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

/**
 * Where the tender record and the ERP file disagree about the invoice's dates. Amounts are NOT compared: the ERP keeps net
 * sales before tax while a tender invoice is usually entered with tax, so a difference there would be noise. `dueDate` is
 * the tender invoice's effective due date. A date the ERP does not hold is never a difference.
 */
export function erpDifferences(inv: { invoiceDate: string; dueDate: string | null }, erp: ErpInvoiceFacts | undefined): string[] {
  if (!erp || !erp.found) return [];
  const out: string[] = [];
  if (erp.invoiceDate && erp.invoiceDate !== inv.invoiceDate) out.push(`the ERP dates this invoice ${erp.invoiceDate}`);
  if (erp.dueDate && inv.dueDate && erp.dueDate !== inv.dueDate) out.push(`the ERP due date is ${erp.dueDate}`);
  return out;
}

/** What the "Fill from ERP" button hands back for the add-invoice form. Only the fields that are safe to prefill. */
export interface ErpPrefill {
  invoiceDate: string | null;
  dueDate: string | null;
  customerName: string | null;
  netSales: number | null;
}

export function prefillFromErp(erp: ErpInvoiceFacts | undefined): ErpPrefill | null {
  if (!erp || !erp.found) return null;
  return { invoiceDate: erp.invoiceDate, dueDate: erp.dueDate, customerName: erp.customerName, netSales: erp.netSales };
}
