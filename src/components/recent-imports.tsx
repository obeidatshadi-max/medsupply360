import { desc, eq, inArray, and } from "drizzle-orm";
import { getDb } from "@/db/client";
import { importBatches } from "@/db/schema";
import type { ImportKind } from "@/core/import/specs";

/** Same clock as the header strip: Jordan time. */
const jordanTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Amman", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

/** The last uploads of one channel's file types. */
export async function RecentImports({ companyId, kinds }: { companyId: string; kinds: readonly ImportKind[] }) {
  const history = await getDb()
    .select({
      id: importBatches.id,
      kind: importBatches.kind,
      fileName: importBatches.fileName,
      snapshotDate: importBatches.snapshotDate,
      rowsAccepted: importBatches.rowsAccepted,
      rowsRejected: importBatches.rowsRejected,
      status: importBatches.status,
      createdAt: importBatches.createdAt,
    })
    .from(importBatches)
    .where(and(eq(importBatches.companyId, companyId), inArray(importBatches.kind, [...kinds])))
    .orderBy(desc(importBatches.createdAt))
    .limit(15);

  return (
    <section aria-label="Recent imports">
      <h2 className="text-sm font-semibold">Recent uploads</h2>
      {history.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing uploaded yet.</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">When (Jordan time)</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">File</th>
                <th className="px-3 py-2 font-medium">As of</th>
                <th className="px-3 py-2 text-right font-medium">Loaded</th>
                <th className="px-3 py-2 text-right font-medium">Rejected</th>
                <th className="px-3 py-2 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t border-line">
                  <td className="px-3 py-2 tabular-nums">{jordanTime.format(h.createdAt)}</td>
                  <td className="px-3 py-2">{h.kind.replace("_", " ")}</td>
                  <td className="px-3 py-2">{h.fileName}</td>
                  <td className="px-3 py-2 tabular-nums">{h.snapshotDate ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{h.rowsAccepted}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{h.rowsRejected}</td>
                  <td className="px-3 py-2">{h.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
