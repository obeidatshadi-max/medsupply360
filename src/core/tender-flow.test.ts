import { describe, expect, it } from "vitest";
import {
  AUTHORITIES,
  PHASES,
  STAGE,
  STATUSES,
  STATUS_LABEL,
  backMove,
  daysInStage,
  forwardMoves,
  isAuthority,
  isClosed,
  isLegalMove,
  missingFor,
  phaseOf,
  type TenderFields,
} from "./tender-flow";

const none: TenderFields = { tenderNo: null, estimatedValue: null, deadline: null, bidValue: null, awardAmount: null, closeReason: null, contractNo: null, contractValue: null, deliveredOn: null };

describe("tender flow", () => {
  it("knows the five authorities", () => {
    expect(AUTHORITIES.map((a) => a.code)).toEqual(["MOH", "KHCC", "DRMS", "JUH", "KAUH"]);
    expect(isAuthority("MOH")).toBe(true);
    expect(isAuthority("XYZ")).toBe(false);
  });

  it("gives every status a label, a stage and exactly one phase", () => {
    for (const s of STATUSES) {
      expect(STATUS_LABEL[s]).toBeTruthy();
      expect(STAGE[s].no).toBeGreaterThanOrEqual(1);
      expect(STAGE[s].no).toBeLessThanOrEqual(10);
      expect([...PHASES.map((p) => p.key), "closed"]).toContain(phaseOf(s));
    }
  });

  it("groups the ten stages into four phases and counts lost and cancelled as closed", () => {
    expect(["pipeline", "open", "preparing"].map((s) => phaseOf(s as never))).toEqual(["before_bidding", "before_bidding", "before_bidding"]);
    expect(["submitted", "technical_review", "financial_review"].map((s) => phaseOf(s as never))).toEqual(["in_evaluation", "in_evaluation", "in_evaluation"]);
    expect(["won", "contracted"].map((s) => phaseOf(s as never))).toEqual(["award_contract", "award_contract"]);
    expect(["delivered", "collected"].map((s) => phaseOf(s as never))).toEqual(["delivery_payment", "delivery_payment"]);
    expect(phaseOf("lost")).toBe("closed");
    expect(phaseOf("cancelled")).toBe("closed");
  });

  it("moves forward along the stages and only to a legal next status", () => {
    expect(forwardMoves("pipeline")).toEqual(["open", "cancelled"]);
    expect(isLegalMove("financial_review", "won")).toBe(true);
    expect(isLegalMove("financial_review", "lost")).toBe(true);
    expect(isLegalMove("preparing", "won")).toBe(false);
    expect(isLegalMove("submitted", "lost")).toBe(false);
    expect(isLegalMove("pipeline", "collected")).toBe(false);
  });

  it("lets a tender step back once, never out of lost, cancelled or the first stage", () => {
    expect(backMove("submitted")).toBe("preparing");
    expect(isLegalMove("submitted", "preparing")).toBe(true);
    expect(backMove("pipeline")).toBeNull();
    expect(backMove("lost")).toBeNull();
    expect(backMove("cancelled")).toBeNull();
    expect(forwardMoves("lost")).toEqual([]);
  });

  it("closes a tender only when it is lost, cancelled or collected", () => {
    expect(STATUSES.filter(isClosed)).toEqual(["lost", "cancelled", "collected"]);
  });

  it("asks for what the stage needs before a tender may enter it", () => {
    expect(missingFor("open", none)).toEqual(["tender number", "estimated value", "submission deadline"]);
    expect(missingFor("open", { ...none, tenderNo: "T-1", estimatedValue: 5000, deadline: "2026-11-01" })).toEqual([]);
    expect(missingFor("submitted", none)).toEqual(["bid value"]);
    expect(missingFor("won", none)).toEqual(["award amount"]);
    expect(missingFor("lost", { ...none, closeReason: "  " })).toEqual(["reason it was lost"]);
    expect(missingFor("contracted", { ...none, contractNo: "PO-9" })).toEqual(["contract value"]);
    expect(missingFor("delivered", none)).toEqual(["delivery date"]);
    expect(missingFor("preparing", none)).toEqual([]);
  });

  it("accepts a zero amount as filled in", () => {
    expect(missingFor("submitted", { ...none, bidValue: 0 })).toEqual([]);
  });

  it("asks for nothing when stepping back", () => {
    expect(missingFor("open", none, "preparing")).toEqual([]);
    expect(missingFor("won", none, "contracted")).toEqual([]);
  });

  it("counts whole days in the current stage", () => {
    expect(daysInStage("2026-10-10T08:00:00Z", "2026-10-18")).toBe(8);
    expect(daysInStage(new Date("2026-10-18T05:00:00Z"), "2026-10-18")).toBe(0);
    expect(daysInStage("2026-10-20T00:00:00Z", "2026-10-18")).toBe(0);
  });
});
