import { describe, expect, it } from "vitest";
import { detectKind } from "./detect";
import { reconcile } from "./reconcile";
import { validateImport } from "./validate";

const TODAY = "2026-10-24";
const HEAD = "authority,tender no,award date,item,bidder,our bid,unit price,result";
const run = (text: string) => validateImport("tender_results", text, { today: TODAY });

describe("tender results file", () => {
  it("reads authority names, yes/no and result words from award notices", () => {
    const r = run(`${HEAD}\nMinistry of Health,MOH-1,2025-03-01,Glucose strips,Sadaf Medical,yes,4.250,Awarded\nKHCC,K-7,15/04/2025,Glucose strips,Rival Co,no,4.100,Lost`);
    expect(r.fatal).toBeNull();
    expect(r.rejected).toEqual([]);
    expect(r.accepted.map((a) => [a.values.authority, a.values.ourBid, a.values.result, a.values.awardDate])).toEqual([
      ["MOH", true, "won", "2025-03-01"],
      ["KHCC", false, "lost", "2025-04-15"],
    ]);
  });

  it("works out the unit price from the line total and the quantity, and keeps it unknown when it cannot", () => {
    const r = run("authority,tender no,award date,item,bidder,quantity,line total\nMOH,T1,2025-03-01,Item A,Acme,200,5000\nMOH,T1,2025-03-01,Item B,Acme,,5000");
    expect(r.accepted[0]!.values.unitPrice).toBe("25.000");
    expect(r.accepted[1]!.values.unitPrice).toBeNull();
  });

  it("keeps a winner-only notice: one row, no other bidders, no price needed", () => {
    const r = run(`${HEAD}\nMOH,T1,2025-03-01,Item A,Winner Ltd,no,,won`);
    expect(r.rejected).toEqual([]);
    expect(r.accepted[0]!.values).toMatchObject({ bidder: "Winner Ltd", unitPrice: null, result: "won" });
  });

  it("rejects what cannot be right, with the reason", () => {
    const r = run(
      [
        HEAD,
        "Unknown Hospital,T1,2025-03-01,Item A,Acme,no,5,won", // authority
        "MOH,T2,2025-03-01,Item A,Acme,no,0,won", // zero price
        "MOH,T3,2025-03-01,Item A,Acme,no,5,maybe", // result
        "MOH,T4,2027-01-01,Item A,Acme,no,5,won", // future date
        "MOH,T5,2025-03-01,Item A,Acme,no,5,won",
        "moh,T5,2025-03-01,item a,ACME,no,6,won", // same bid twice
      ].join("\n"),
    );
    expect(r.accepted.map((a) => a.row)).toEqual([6]);
    const reasons = Object.fromEntries(r.rejected.map((x) => [x.row, x.reason]));
    expect(reasons[2]).toMatch(/unrecognised authority/);
    expect(reasons[3]).toMatch(/greater than zero/);
    expect(reasons[4]).toMatch(/unrecognised result/);
    expect(reasons[5]).toMatch(/after today/);
    expect(reasons[7]).toMatch(/duplicate of row 6/);
  });

  it("refuses a winner that failed the technical review", () => {
    const r = run("authority,tender no,award date,item,bidder,result,technical pass\nMOH,T1,2025-03-01,Item A,Acme,won,no");
    expect(r.rejected[0]!.reason).toMatch(/technical review/);
  });

  it("is recognised from its headings and not mistaken for another file", () => {
    expect(detectKind(`${HEAD}\n`)).toEqual({ kind: "tender_results", certain: true });
    expect(detectKind("code,name,category\n").kind).not.toBe("tender_results");
  });

  it("totals what was loaded, with the gaps stated", () => {
    const r = run(
      `${HEAD},currency\nMOH,T1,2025-03-01,Item A,Sadaf,yes,5,won,JOD\nMOH,T1,2025-03-01,Item A,Rival,no,,lost,JOD\nKHCC,T2,2025-04-01,Item B,Rival,no,9,won,USD`,
    );
    const lines = Object.fromEntries(reconcile("tender_results", r.accepted, null).map((l) => [l.label, l.value]));
    expect(lines["Bid rows loaded"]).toBe("3");
    expect(lines["Tenders"]).toBe("2");
    expect(lines["Items asked for"]).toBe("2");
    expect(lines["Rows without a price (kept, price unknown)"]).toBe("1");
    expect(lines["Prices not in JOD (not compared)"]).toBe("1");
    expect(lines["Our bids"]).toBe("1");
  });
});
