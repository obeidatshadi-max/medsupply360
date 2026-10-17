import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildProductReorders } from "@/core/product-reorders";
import { ProductReorders } from "./product-reorders";

describe("product reorder presentation", () => {
  it("explains insufficient history and flags incomplete sales without inventing predictions", () => {
    const report = { ...buildProductReorders([], "2026-10-17"), latestImport: "2026-10-16", partialImport: true };
    const html = renderToStaticMarkup(createElement(ProductReorders, { report }));
    expect(html).toContain("No product pairs have enough eligible history");
    expect(html).toContain("latest sales import rejected some rows");
    expect(html).toContain("Forecast accuracy has not been validated");
    expect(html).not.toContain("<table");
  });
});
