import "server-only";
import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db/client";
import { importBatches } from "@/db/schema";
import { SPECS, type ImportKind } from "@/core/import/specs";

export interface LastImportRow {
  kind: ImportKind;
  createdAt: Date;
  snapshotDate: string | null;
  status: "accepted" | "partial" | "rejected";
}

const when = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Amman", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * The text for "Data last integrated". Only an import that actually loaded rows counts; a fully rejected file
 * integrated nothing. A partial load says so, and a snapshot file names the date its figures are as of.
 */
export function formatLastImport(row: LastImportRow | undefined): string {
  if (!row || row.status === "rejected") return "Not connected — no imports completed";
  const parts = [`${when.format(row.createdAt)} Jordan time`, SPECS[row.kind].title];
  if (row.snapshotDate) parts.push(`as of ${row.snapshotDate}`);
  if (row.status === "partial") parts.push("some rows rejected");
  return parts.join(" · ");
}

/**
 * The company's most recent import that loaded at least one row. Tender results are not Alpha ERP data, so loading them
 * must not make the ERP figures look freshly integrated.
 */
export async function lastImportText(companyId: string): Promise<string> {
  const [row] = await getDb()
    .select({ kind: importBatches.kind, createdAt: importBatches.createdAt, snapshotDate: importBatches.snapshotDate, status: importBatches.status })
    .from(importBatches)
    .where(and(eq(importBatches.companyId, companyId), ne(importBatches.status, "rejected"), ne(importBatches.kind, "tender_results")))
    .orderBy(desc(importBatches.createdAt))
    .limit(1);
  return formatLastImport(row);
}
