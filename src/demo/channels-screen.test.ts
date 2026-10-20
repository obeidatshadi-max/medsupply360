import { describe, expect, it } from "vitest";
import { CHANNELS, CHANNEL_INFO } from "@/core/channels";
import { SERVICE_OPTIONS } from "@/core/machine-details";
import { units } from "./dataset";
import { channelsHtml, demoChannelStatus, machineDetailsHtml, manualChannelHtml, samplePreviewHtml, tenderChannelHtml } from "./channels-screen";

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

  it("reads the manual sample like the live upload: guide tab out, equipment found under its title, sales team recognised", () => {
    const html = samplePreviewHtml("manual");
    expect(html).toContain("Installed equipment (E11 or manual)");
    expect(html).toContain("headings found on row 3");
    expect(html).toContain("Sales force and targets (manual)");
    expect(html).toContain("This tab explains or shows examples");
    expect(html).toContain("Confirm and save 2 tabs");
  });

  it("reads the tender sample: full authority names and stage words are fine, a notes tab is left out", () => {
    const html = samplePreviewHtml("tender");
    expect(html).toContain("Tender list (tender department)");
    expect(html).toContain("3 rows");
    expect(html).toContain("This tab explains or shows examples");
    expect(html).toContain("Confirm and save 1 tab");
  });

  it("has a Manual and a Tender screen", () => {
    expect(manualChannelHtml(units)).toContain('data-channel="manual"');
    expect(tenderChannelHtml()).toContain('data-channel="tender"');
    expect(tenderChannelHtml()).toContain('data-route="tenders"');
  });
});

describe("demo machine details form", () => {
  it("offers every demo machine in a dropdown and the app's service options", () => {
    const html = manualChannelHtml(units);
    expect(html).toContain("Choose a machine…");
    for (const u of units) expect(html).toContain(`value="${u.id}"`);
    for (const o of SERVICE_OPTIONS) expect(machineDetailsHtml(units)).toContain(`<option>${o}</option>`);
  });
});
