import { describe, expect, it } from "vitest";
import { validateImport } from "./validate";

const TODAY = "2026-11-11";
const HEAD = "Invoice No,Line No,Invoice Date,Customer Code,Product Code,Quantity,Net Sales";

describe("grouped report (details printed once per invoice)", () => {
  it("copies invoice no., date and customer from the line above, and says so once", () => {
    const csv = [HEAD, "I1,1,05/11/2026,C1,P1,2,100", ",2,,,P2,1,50", ",3,,,P3,4,25", "I2,1,06/11/2026,C2,P1,1,10", ",2,,,P2,1,20"].join("\n");
    const r = validateImport("sales", csv, { today: TODAY });
    expect(r.fatal).toBeFalsy();
    expect(r.rejected).toEqual([]);
    expect(r.accepted.map((a) => [a.values.invoiceNo, String(a.values.lineNo), a.values.invoiceDate, a.values.customerCode])).toEqual([
      ["I1", "1", "2026-11-05", "C1"],
      ["I1", "2", "2026-11-05", "C1"],
      ["I1", "3", "2026-11-05", "C1"],
      ["I2", "1", "2026-11-06", "C2"],
      ["I2", "2", "2026-11-06", "C2"],
    ]);
    const notes = r.warnings.filter((w) => w.reason.startsWith("grouped report"));
    expect(notes).toHaveLength(1);
    expect(notes[0]!.row).toBe(3);
    expect(notes[0]!.reason).toContain("on 3 lines");
  });

  it("never fills an amount or a quantity", () => {
    const csv = [HEAD, "I1,1,05/11/2026,C1,P1,2,100", ",2,,,P2,,"].join("\n");
    const r = validateImport("sales", csv, { today: TODAY });
    expect(r.accepted).toHaveLength(1);
    expect(r.rejected).toHaveLength(1);
    expect(r.rejected[0]!.reason).toMatch(/empty/);
  });

  it("leaves a line with only some details blank to be rejected", () => {
    const csv = [HEAD, "I1,1,05/11/2026,C1,P1,2,100", ",2,05/11/2026,,P2,1,50"].join("\n");
    const r = validateImport("sales", csv, { today: TODAY });
    expect(r.rejected.map((x) => x.row)).toEqual([3]);
    expect(r.warnings.some((w) => w.reason.startsWith("grouped report"))).toBe(false);
  });

  it("does not fill when the first line is itself blank", () => {
    const csv = [HEAD, ",1,,,P1,2,100", "I1,1,05/11/2026,C1,P1,2,100"].join("\n");
    const r = validateImport("sales", csv, { today: TODAY });
    expect(r.rejected.map((x) => x.row)).toEqual([2]);
  });

  it("works for receipts split over several invoices", () => {
    const csv = ["Receipt No,Allocation Id,Receipt Date,Customer Code,Invoice No,Allocated Amount", "R1,1,01/11/2026,C1,I1,40", ",2,,,I2,60"].join("\n");
    const r = validateImport("receipts", csv, { today: TODAY });
    expect(r.rejected).toEqual([]);
    expect(r.accepted.map((a) => [a.values.receiptNo, a.values.customerCode, Number(a.values.allocatedAmount)])).toEqual([
      ["R1", "C1", 40],
      ["R1", "C1", 60],
    ]);
  });

  it("leaves an ordinary table untouched", () => {
    const csv = [HEAD, "I1,1,05/11/2026,C1,P1,2,100", "I1,2,05/11/2026,C1,P2,1,50"].join("\n");
    const r = validateImport("sales", csv, { today: TODAY });
    expect(r.accepted).toHaveLength(2);
    expect(r.warnings.some((w) => w.reason.startsWith("grouped report"))).toBe(false);
  });
});
