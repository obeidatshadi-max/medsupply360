import { describe, expect, it } from "vitest";
import { money } from "./parsers";
import { applySmartMatch, smartKind, smartMatch } from "./smart-columns";
import { validateImport } from "./validate";
import { readSheetGrid } from "./workbook";

const TODAY = "2026-11-11";
const SALES_AR = ["رقم الفاتورة", "رقم السطر", "تاريخ الفاتورة", "رمز العميل", "رمز المادة", "الكمية", "صافي القيمة"];

describe("Alpha reports with Arabic headings", () => {
  it("reads رمز / كود / رقم, مادة / صنف and زبون / عميل as the same words", () => {
    const csv = "رقم الفاتورة,رقم السطر,تاريخ الفاتورة,كود الزبون,رمز المادة,الكمية,صافي القيمة\n1001,1,05/10/2026,C-1,P-1,10,100\n";
    expect(smartMatch("sales", csv)).toEqual({ customerCode: "كود الزبون", productCode: "رمز المادة" });
  });

  it("finds the heading row under the report title and date range, and the type with it", () => {
    const grid = { sheet: "Sheet1", data: [["تقرير المبيعات التفصيلي"], ["من 01/10/2026 الى 31/10/2026"], SALES_AR, ["1001", "1", "05/10/2026", "C-1", "P-1", "10", "1,250.500"]] };
    const read = readSheetGrid(grid);
    expect(read.headerRow).toBe(3);
    expect(smartKind(read.csv)).toBe("sales");
    const { csv } = applySmartMatch("sales", read.csv);
    const r = validateImport("sales", csv, { today: TODAY });
    expect(r.rejected).toEqual([]);
    expect(r.accepted[0]!.values).toMatchObject({ invoiceNo: "1001", customerCode: "C-1", productCode: "P-1", netSales: "1250.500" });
  });
});

describe("sales lines without a line-number column", () => {
  it("numbers the lines within each invoice in file order, and says so", () => {
    const csv = ["Invoice No,Invoice Date,Customer Code,Product Code,Quantity,Net Sales", "I1,05/10/2026,C1,P1,2,100", ",,,P2,1,50", "I2,06/10/2026,C2,P1,1,10", "I1,05/10/2026,C1,P3,1,5"].join("\n");
    const r = validateImport("sales", csv, { today: TODAY });
    expect(r.rejected).toEqual([]);
    expect(r.accepted.map((a) => `${a.values.invoiceNo}/${a.values.lineNo}`)).toEqual(["I1/1", "I1/2", "I2/1", "I1/3"]);
    expect(r.warnings.some((w) => w.reason.includes("numbered the lines"))).toBe(true);
  });

  it("keeps the file's own line numbers when it has them", () => {
    const csv = ["Invoice No,Line No,Invoice Date,Customer Code,Product Code,Quantity,Net Sales", "I1,7,05/10/2026,C1,P1,2,100"].join("\n");
    const r = validateImport("sales", csv, { today: TODAY });
    expect(String(r.accepted[0]!.values.lineNo)).toBe("7");
    expect(r.warnings.some((w) => w.reason.includes("numbered the lines"))).toBe(false);
  });
});

describe("amounts written with a currency", () => {
  it("takes a Jordanian dinar mark off", () => {
    for (const raw of ["JD 1,250.500", "1250.500 JOD", "1,250.500 د.أ", "1250.5 دينار", "jod1250.5"]) expect(money(raw)).toEqual({ ok: true, value: "1250.500", warning: undefined });
  });

  it("refuses another currency instead of reading it as dinars", () => {
    for (const raw of ["$ 1,250", "1250 USD", "IQD 25,000", "25,000 د.ع", "100 €"]) {
      const r = money(raw);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/another currency/);
    }
  });
});
