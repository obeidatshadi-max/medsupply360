import { describe, expect, it } from "vitest";
import { awardDateOf } from "./award-date";

const at = (iso: string) => new Date(iso);

describe("awardDateOf", () => {
  it("takes the day the tender last entered Won or Lost, in Jordan time", () => {
    expect(awardDateOf([{ toStatus: "pipeline", at: at("2026-05-01T08:00:00Z") }, { toStatus: "lost", at: at("2026-09-05T08:00:00Z") }])).toBe("2026-09-05");
    // 22:30 UTC is already the next day in Amman (UTC+3)
    expect(awardDateOf([{ toStatus: "won", at: at("2026-09-05T22:30:00Z") }, { toStatus: "contracted", at: at("2026-10-01T08:00:00Z") }])).toBe("2026-09-06");
  });
  it("is null for a tender that was never decided", () => {
    expect(awardDateOf([{ toStatus: "open", at: at("2026-05-01T08:00:00Z") }])).toBeNull();
    expect(awardDateOf([])).toBeNull();
  });
});
