import { describe, expect, it } from "vitest";
import { reconcile } from "./reconcile";
import type { RowRef } from "./specs";

const row = (n: number, values: RowRef["values"]): RowRef => ({ row: n, values });

describe("sales summary", () => {
  const rows = [
    row(2, { invoiceNo: "I1", lineNo: "1", invoiceDate: "2026-09-01", dueDate: "2026-10-01", docType: "invoice", quantity: "2", netSales: "100", productCost: null }),
    row(3, { invoiceNo: "I1", lineNo: "2", invoiceDate: "2026-09-01", dueDate: "2026-10-01", docType: "invoice", quantity: "1", netSales: "50", productCost: null }),
    row(4, { invoiceNo: "CN1", lineNo: "1", invoiceDate: "2026-09-10", dueDate: null, docType: "return", quantity: "-1", netSales: "-20", productCost: null }),
  ];
  const lines = reconcile("sales", rows, null);
  const get = (label: string) => lines.find((l) => l.label === label)?.value;

  it("counts a credit note apart from the invoices", () => {
    expect(get("Invoices")).toBe("1");
    expect(get("Credit notes (returns)")).toBe("1");
  });

  it("does not report a credit note as an invoice without a due date", () => {
    expect(get("Invoices without a due date")).toBe("0");
  });
});
