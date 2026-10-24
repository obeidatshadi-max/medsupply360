import { describe, expect, it } from "vitest";
import { activityProgress, cleanVisit, monthOf, newAccountsInMonth, weekEnd, weekStart } from "./sales-activity";

describe("weeks", () => {
  it("starts the week on Monday", () => {
    expect(weekStart("2026-10-20")).toBe("2026-10-19"); // Tuesday
    expect(weekStart("2026-10-19")).toBe("2026-10-19"); // Monday
    expect(weekStart("2026-10-25")).toBe("2026-10-19"); // Sunday
    expect(weekEnd("2026-10-19")).toBe("2026-10-25");
    expect(weekStart("2026-01-01")).toBe("2025-12-29");
  });
});

describe("new accounts", () => {
  it("counts accounts whose first order is in the month, not older ones or ones with no invoice", () => {
    expect(newAccountsInMonth(["2026-09-02", "2026-09-30", "2026-08-31", "2025-09-10", null], "2026-09")).toBe(2);
    expect(monthOf("2026-09-30")).toBe("2026-09");
    expect(newAccountsInMonth([], "2026-09")).toBe(0);
  });
});

describe("progress", () => {
  it("is on target at or above the target, behind below it, and unjudged without one", () => {
    expect(activityProgress(5, 5)).toEqual({ status: "on", ratio: 1 });
    expect(activityProgress(2, 5)).toEqual({ status: "behind", ratio: 0.4 });
    expect(activityProgress(3, null)).toEqual({ status: "none", ratio: null });
    expect(activityProgress(3, 0)).toEqual({ status: "none", ratio: null });
  });
});

describe("cleanVisit", () => {
  const today = "2026-10-20";
  const ok = (visitedOn: string, note = "", customerId = "") => cleanVisit({ visitedOn, note, customerId }, today);
  it("accepts today and the past, trims the note, and treats empty fields as none", () => {
    expect(ok("2026-10-20", "  Met the lab manager  ")).toEqual({ ok: true, value: { visitedOn: "2026-10-20", customerId: null, note: "Met the lab manager" } });
    expect(ok("2026-10-14", "", "abc")).toEqual({ ok: true, value: { visitedOn: "2026-10-14", customerId: "abc", note: null } });
  });
  it("refuses a bad, future or very old date and a long note", () => {
    expect(ok("20/10/2026").ok).toBe(false);
    expect(ok("2026-10-21").ok).toBe(false);
    expect(ok("2026-01-01").ok).toBe(false);
    expect(ok("2026-10-20", "x".repeat(301)).ok).toBe(false);
  });
});
