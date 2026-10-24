import { buildProductReorders, type ProductOrder } from "@/core/product-reorders";
import { validateImport } from "@/core/import/validate";
import { ERP_KINDS, SPECS, type ImportKind } from "@/core/import/specs";
import { DEMO_AS_OF } from "./dataset";

const days = ["2026-05-01", "2026-05-31", "2026-06-30", "2026-07-30"];
export function demoProductReorders() {
  const base: ProductOrder = { customerCode: "DEMO-C1", customerName: "Dabouq Heights Private Hospital", productCode: "DEMO-P1",
    productName: "Example repeat consumable A", segment: "Private", category: "Consumables", unit: "pack", date: days[0], quantity: 20, value: 200 };
  return buildProductReorders([
    ...days.map((date) => ({ ...base, date })),
    { ...base, productCode: "DEMO-P2", productName: "Example repeat consumable B", date: "2026-10-07", quantity: 5 },
    ...["2026-06-15", "2026-07-15", "2026-08-14", "2026-09-13"].map((date) => ({ ...base, customerCode: "DEMO-C2", customerName: "Irbid Al-Wasl Surgical Center", date, quantity: 10 })),
    ...days.map((date) => ({ ...base, customerCode: "DEMO-T1", customerName: "Northern Region Public Medical Complex", segment: "Tender", date })),
    { ...base, customerCode: "DEMO-U1", customerName: "Unclassified walk-in account", segment: null },
  ], DEMO_AS_OF);
}

export function demoReadiness() {
  return ERP_KINDS.map((kind) => ({ kind, title: SPECS[kind].title,
    loadedOn: ["products", "customers", "sales", "open_invoices", "stock_snapshot"].includes(kind) ? "2026-10-08" : null,
    snapshotDate: SPECS[kind].snapshot ? "2026-10-08" : null,
    load: kind === "sales" ? "Partial sample: 2 rejected rows" : ["products", "customers", "open_invoices", "stock_snapshot"].includes(kind) ? "Sample rows accepted" : "Missing in this scenario",
    attempt: kind === "stock_snapshot" ? "Rejected replacement; prior sample retained" : "Illustrative only",
  }));
}

export function checkDemoImport(kind: ImportKind, raw: string) {
  const result = validateImport(kind, raw, { today: DEMO_AS_OF, snapshotDate: SPECS[kind].snapshot ? DEMO_AS_OF : undefined });
  const blocked = !!result.fatal || (SPECS[kind].snapshot === true && result.rejected.length > 0);
  return { ...result, blocked, readyRows: blocked ? 0 : result.accepted.length };
}

export const SNAPSHOT_SAMPLE = "product code,warehouse,batch,qty,unit cost\nDEMO-P1,Main,B1,10,5";
export const SNAPSHOT_BAD_SAMPLE = `${SNAPSHOT_SAMPLE}\nDEMO-P2,Main,B2,not-a-number,5`;

/** Canonical field keys and samples accepted by the actual application's parser. */
export function currentAppTemplate(kind: ImportKind) {
  const values: Record<ImportKind, Record<string, string>> = {
    products: { code: "DEMO-P1", name: "Example consumable", line: "Consumables", unit: "pack", active: "yes" },
    customers: { code: "DEMO-C1", name: "Demo private hospital", segment: "Private", city: "Amman", paymentTermsDays: "30" },
    sales: { invoiceNo: "DEMO-I1", lineNo: "1", invoiceDate: "2026-09-01", dueDate: "2026-10-01", docType: "invoice", customerCode: "DEMO-C1", productCode: "DEMO-P1", quantity: "10", netSales: "100", productCost: "60" },
    receipts: { receiptNo: "DEMO-R1", allocationRowId: "1", receiptDate: "2026-09-15", customerCode: "DEMO-C1", invoiceNo: "DEMO-I1", allocatedAmount: "40", receiptTotal: "40" },
    open_invoices: { snapshotDate: DEMO_AS_OF, invoiceNo: "DEMO-I1", customerCode: "DEMO-C1", invoiceDate: "2026-09-01", dueDate: "2026-10-01", remainingAmount: "60" },
    stock_snapshot: { snapshotDate: DEMO_AS_OF, productCode: "DEMO-P1", warehouse: "Demo main", batch: "DEMO-B1", quantity: "10", unitCost: "6", expiryDate: "2027-10-01", owned: "Owned" },
    stock_transactions: { transactionId: "DEMO-T1", txDate: "2026-09-01", productCode: "DEMO-P1", warehouse: "Demo main", batch: "DEMO-B1", txType: "customer_issue", quantity: "-10" },
    installed_units: { code: "DEMO-U1", customerCode: "DEMO-C1", name: "Example installed equipment", installedOn: "2025-01-01", warrantyEnd: "2027-01-01", service: "Active" },
    tender_results: { authority: "MOH", tenderNo: "DEMO-T-001", awardDate: "2026-06-30", itemName: "Example analyzer reagent", bidder: "Demo Medical Co", ourBid: "yes", unitPrice: "12.500", currency: "JOD", result: "won" },
  };
  const headers = SPECS[kind].fields.map((f) => f.key);
  return [headers, headers.map((key) => values[kind][key] ?? "")].map((row) => row.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\r\n");
}
