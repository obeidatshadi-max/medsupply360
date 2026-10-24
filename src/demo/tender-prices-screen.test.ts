import { describe, expect, it } from "vitest";
import { tenderPricesCsvRows, tenderPricesHtml } from "./tender-prices-screen";

describe("demo price history screen", () => {
  it("shows the real authority names for the Sadaf preset and neutral labels for any other customer", () => {
    expect(tenderPricesHtml({ generic: false })).toContain("Ministry of Health");
    const generic = tenderPricesHtml({ generic: true });
    expect(generic).toContain("Authority A");
    expect(generic).not.toMatch(/Ministry of Health|King Hussein|Royal Medical Services|Jordan University Hospital/);
    expect(generic).not.toMatch(/>(MOH|KHCC|DRMS|JUH|KAUH)</);
  });

  it("says the data is made up and narrows the items with the search text", () => {
    const html = tenderPricesHtml({ generic: false, query: "glucose" });
    expect(html).toContain("Made-up data");
    expect(html).toContain("Glucose test strips 50");
    expect(html).not.toContain("Pipette tips 1000");
    expect(tenderPricesCsvRows(false, "glucose")).toHaveLength(2);
  });

  it("keeps the way back to the tenders", () => {
    expect(tenderPricesHtml({ generic: false })).toContain('data-route="tenders"');
  });
});
