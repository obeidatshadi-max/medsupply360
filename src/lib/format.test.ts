import { describe, expect, it } from "vitest";
import { addDays } from "./format";

describe("addDays", () => {
  it("moves across month and year ends", () => {
    expect(addDays("2026-09-30", -29)).toBe("2026-09-01");
    expect(addDays("2026-01-05", -10)).toBe("2025-12-26");
  });
  it("handles a leap day", () => {
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });
});
