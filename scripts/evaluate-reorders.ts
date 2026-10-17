/** Offline benchmark; never connects to or changes the company database. */
import { readFileSync } from "node:fs";
import { z } from "zod";
import { isIsoDate } from "../src/core/calc";
import { evaluateProductReorders } from "../src/core/product-reorders";

const date = z.string().refine(isIsoDate, "Expected a real YYYY-MM-DD date");
const inputSchema = z.object({
  observedThrough: date,
  cutoffs: z.array(date).min(1),
  horizonDays: z.number().int().min(1).max(365).default(30),
  rows: z.array(z.object({
    customerCode: z.string().min(1), customerName: z.string(), productCode: z.string().min(1), productName: z.string(),
    segment: z.enum(["Private", "Tender"]).nullable(), category: z.enum(["Consumables", "Equipment", "Devices"]),
    unit: z.string().nullable(), date, availableOn: date.optional(), quantity: z.number().finite(), value: z.number().finite(),
  })),
});

try {
  const path = process.argv[2];
  if (!path) throw new Error("Usage: npm run predictions:evaluate -- path/to/normalized-history.json");
  const input = inputSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  const report = evaluateProductReorders(input.rows, input.cutoffs, input.observedThrough, input.horizonDays);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
