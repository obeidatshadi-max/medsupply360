import { describe, expect, it } from "vitest";
import { CHANNELS, CHANNEL_INFO, channelOfKind, channelState, lastUpdateText, type ChannelStatus } from "./channels";
import { IMPORT_ORDER } from "./import/detect";

const now = new Date("2026-10-20T08:00:00Z");
const status = (lastUpdate: string | null, by: string | null = null): ChannelStatus => ({ channel: "erp", lastUpdate, by, facts: [], missing: [] });

describe("channels", () => {
  it("puts every uploadable file type in exactly one channel", () => {
    for (const kind of IMPORT_ORDER) {
      const owners = CHANNELS.filter((c) => (CHANNEL_INFO[c].kinds as readonly string[]).includes(kind));
      expect(owners, kind).toHaveLength(1);
    }
  });

  it("sends installed equipment to the manual channel and sales files to ERP", () => {
    expect(channelOfKind("installed_units")).toBe("manual");
    expect(channelOfKind("sales")).toBe("erp");
  });

  it("calls a channel never fed, fresh or stale from its own limit", () => {
    expect(channelState(status(null), now)).toBe("never");
    expect(channelState(status("2026-10-14T08:00:00Z"), now)).toBe("fresh");
    expect(channelState(status("2026-10-12T07:00:00Z"), now)).toBe("stale");
    expect(channelState({ channel: "manual", lastUpdate: "2026-09-01T00:00:00Z" }, now)).toBe("fresh");
  });

  it("words the last update", () => {
    expect(lastUpdateText(status(null), now)).toBe("Nothing received yet");
    expect(lastUpdateText(status("2026-10-20T01:00:00Z"), now)).toBe("Last update today");
    expect(lastUpdateText(status("2026-10-19T01:00:00Z", "Rana"), now)).toBe("Last update yesterday by Rana");
    expect(lastUpdateText(status("2026-10-15T08:00:00Z"), now)).toBe("Last update 5 days ago");
  });
});
