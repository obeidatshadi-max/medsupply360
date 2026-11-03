import { describe, expect, it } from "vitest";
import { SERVICE_STALE_AFTER_DAYS, serviceDataState, serviceDataText } from "./service-data";

const now = new Date("2026-11-20T08:00:00Z");

describe("service data freshness", () => {
  it("is never when nothing arrived, fresh within the limit and stale after it", () => {
    expect(serviceDataState(null, now)).toBe("never");
    expect(serviceDataState("2026-10-20T08:00:00Z", now)).toBe("fresh");
    expect(serviceDataState("2026-10-15T07:00:00Z", now)).toBe("stale");
    expect(SERVICE_STALE_AFTER_DAYS).toBe(35);
  });

  it("words the last update", () => {
    expect(serviceDataText(null, null, now)).toBe("Nothing received yet");
    expect(serviceDataText("2026-11-20T01:00:00Z", null, now)).toBe("Last update today");
    expect(serviceDataText("2026-11-19T01:00:00Z", "Rami", now)).toBe("Last update yesterday by Rami");
    expect(serviceDataText("2026-11-10T08:00:00Z", null, now)).toBe("Last update 10 days ago");
  });
});
