import { describe, expect, it } from "vitest";
import { detectKind } from "./detect";
import { applySmartMatch, phraseScore, sameWord, smartKind, smartMatch, words } from "./smart-columns";
import { validateImport } from "./validate";

describe("sameWord / phraseScore", () => {
  it("reads short forms and one-letter typos as the same word", () => {
    expect(sameWord("cust", "customer")).toBe(true);
    expect(sameWord("qty", "quantity")).toBe(true);
    expect(sameWord("amt", "amount")).toBe(true);
    expect(sameWord("nme", "name")).toBe(true);
    expect(sameWord("recipt", "receipt")).toBe(true);
    expect(sameWord("no", "name")).toBe(false);
    expect(sameWord("city", "code")).toBe(false);
  });

  it("splits camelCase and folds Arabic article, hamza and taa marbuta", () => {
    expect(words("InvoiceDate")).toEqual(["invoice", "date"]);
    expect(words("تاريخ الفاتورة")).toEqual(words("تاريخ فاتوره"));
  });

  it("gives a full score to the same words in any order and refuses a match on a generic word alone", () => {
    expect(phraseScore(["date", "invoice"], ["invoice", "date"])).toBe(1);
    expect(phraseScore(["total", "paid"], ["paid"])).toBe(0.8);
    expect(phraseScore(["doc", "date"], ["date"])).toBe(0);
  });
});

describe("smartMatch", () => {
  it("matches reworded, abbreviated and misspelt headings", () => {
    const csv = "Cust. No,Customer Nme,Town Name\nC-1,Al Shifa,Amman\n";
    expect(smartMatch("customers", csv)).toEqual({ code: "Cust. No", name: "Customer Nme", city: "Town Name" });
  });

  it("matches Arabic headings written without the article", () => {
    const csv = "رقم فاتوره,تاريخ فاتورة,اسم عميل,القيمة قبل الضريبة\nI1,05/11/2026,مستشفى,100\n";
    const m = smartMatch("invoice_totals", csv);
    expect(m.invoiceDate).toBe("تاريخ فاتورة");
    expect(m.customerName).toBe("اسم عميل");
  });

  it("guesses nothing when two headings fit one field equally well", () => {
    const csv = "Customer code,Cust Name,Customer Nme\nC-1,A,B\n";
    expect(smartMatch("customers", csv).name).toBeUndefined();
  });

  it("never matches a heading that is only a generic word", () => {
    const csv = "No,Receipt date,Customer code,Allocated amount,Allocation id\nR1,2026-10-01,C-1,10,1\n";
    expect(smartMatch("receipts", csv).receiptNo).toBeUndefined();
  });

  it("finds the one date column by what it holds, when exactly one date field is left", () => {
    const csv = "Receipt no,Allocation id,Day,Customer code,Allocated amount\nR1,1,01/10/2026,C-1,10\nR2,1,2026-10-02,C-2,20\n";
    expect(smartMatch("receipts", csv)).toEqual({ receiptDate: "Day" });
  });

  it("leaves headings the importer already knows to the importer", () => {
    expect(smartMatch("customers", "Customer code,Customer name\nC-1,A\n")).toEqual({});
  });
});

describe("smartKind and applySmartMatch", () => {
  const csv = "Cust. No,Customer Nme,Town Name\nC-1,Al Shifa,Amman\nC-2,Al Noor,Irbid\n";

  it("finds the type when no type fits by name but exactly one fits with smart matching", () => {
    expect(detectKind(csv).kind).toBeNull();
    expect(smartKind(csv)).toBe("customers");
    expect(smartKind(csv, ["sales"])).toBeNull();
  });

  it("renames the matched headings so the unchanged importer accepts every row", () => {
    const { csv: named, matched } = applySmartMatch("customers", csv);
    expect(Object.keys(matched).sort()).toEqual(["city", "code", "name"]);
    const r = validateImport("customers", named, { today: "2026-11-11" });
    expect(r.fatal).toBeFalsy();
    expect(r.rejected).toEqual([]);
    expect(r.accepted.map((a) => a.values.name)).toEqual(["Al Shifa", "Al Noor"]);
  });
});
