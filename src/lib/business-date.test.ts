import { describe, expect, it } from "vitest";
import { businessToday } from "./business-date";

describe("businessToday", () => {
  it("is already the next day in Amman at 00:30, while UTC is still on the previous day", () => {
    const at = new Date("2026-11-26T21:30:00Z"); // 00:30 on 27 Nov in Amman (UTC+3)
    expect(at.toISOString().slice(0, 10)).toBe("2026-11-26");
    expect(businessToday(at)).toBe("2026-11-27");
  });
});
