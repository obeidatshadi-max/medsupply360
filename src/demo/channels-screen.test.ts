import { describe, expect, it } from "vitest";
import { CHANNELS, CHANNEL_INFO } from "@/core/channels";
import { channelsHtml, demoChannelStatus, manualChannelHtml, manualPreviewHtml, tenderChannelHtml } from "./channels-screen";

describe("demo data channels", () => {
  it("shows the three channels, each with a way in", () => {
    const html = channelsHtml();
    for (const c of CHANNELS) {
      expect(html).toContain(CHANNEL_INFO[c].title);
      expect(html).toContain(`data-route="chan-${c}"`);
    }
  });

  it("lets one channel go stale, so the card shows what that looks like", () => {
    const html = channelsHtml();
    expect(html).toContain("Needs an update");
    expect(html).toContain("Up to date");
    expect(html).toContain("Still missing");
    expect(demoChannelStatus().tender.by).toBe("Lina Haddad");
  });

  it("names the customer's own accounting system and escapes it", () => {
    const html = channelsHtml({ erpName: '<img src=x onerror="1">' });
    expect(html).not.toContain("<img");
    expect(channelsHtml({ erpName: "Atlas ERP" })).toContain("Atlas ERP exports");
  });

  it("reads the sample workbook like the live upload: guide tab out, equipment found under its title", () => {
    const html = manualPreviewHtml();
    expect(html).toContain("Installed equipment (E11 or manual)");
    expect(html).toContain("headings found on row 3");
    expect(html).toContain("2 rows");
    expect(html).toContain("This tab explains or shows examples");
    expect(html).toContain("Confirm and save 1 tab");
  });

  it("has a Manual and a Tender screen", () => {
    expect(manualChannelHtml()).toContain("chanSample");
    expect(tenderChannelHtml()).toContain('data-route="tenders"');
  });
});
