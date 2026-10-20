"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { runImport, type ImportOutcome } from "@/db/import-writer";
import { SPECS, type ImportKind } from "@/core/import/specs";
import { isIsoDate } from "@/core/calc";
import { readSubmitter } from "@/core/submitter";
import { writeAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";

/** Largest file accepted. Netlify functions cap a request body near 6 MB, so stay under it and ask for monthly splits. */
const MAX_FILE_BYTES = 4_500_000;
/** Codes one upload may announce to a check (customer and product lists are small next to sales files). */
const MAX_ASSUMED_CODES = 100_000;
/** Rows echoed back to the page; the full list of rejections is still counted and the first 50 are stored on the batch. */
const SHOWN_ROWS = 200;

export type ImportActionState = {
  error?: string;
  fileName?: string;
  outcome?: ImportOutcome & { rejectionsHidden: number; warningsHidden: number };
};

const formSchema = z.object({
  kind: z.enum(Object.keys(SPECS) as [ImportKind, ...ImportKind[]]),
  mode: z.enum(["check", "import"]),
  snapshotDate: z.string().trim(),
});

export async function importAction(_prev: ImportActionState, formData: FormData): Promise<ImportActionState> {
  const user = await getCurrentUser();
  if (!user || user.guest || user.role !== "owner") return { error: "Only the company owner can import data." };

  const parsed = formSchema.safeParse({
    kind: formData.get("kind"),
    mode: formData.get("mode"),
    snapshotDate: String(formData.get("snapshotDate") ?? ""),
  });
  if (!parsed.success) return { error: "Choose the type of file." };
  const { kind, mode, snapshotDate } = parsed.data;
  if (snapshotDate !== "" && !isIsoDate(snapshotDate)) return { error: "The snapshot date is not a valid date." };

  // A check changes nothing, so only a real import needs a name.
  const who = readSubmitter(formData);
  if (mode === "import" && !who.ok) return { error: who.error };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file." };
  if (file.size > MAX_FILE_BYTES) {
    return { error: `The file is ${(file.size / 1e6).toFixed(1)} MB. The limit is ${(MAX_FILE_BYTES / 1e6).toFixed(1)} MB: export one month at a time.` };
  }
  const text = await file.text();
  if (text.includes("�")) {
    return { error: "The file is not UTF-8, so Arabic names would be garbled. In Excel use Save As, CSV UTF-8 (Comma delimited)." };
  }

  const dryRun = mode !== "import";
  // A check of a whole upload: the lists in the same upload will exist by the time the sales file is saved.
  const codes = (name: string) =>
    dryRun
      ? String(formData.get(name) ?? "")
          .split("\n")
          .map((c) => c.trim())
          .filter(Boolean)
          .slice(0, MAX_ASSUMED_CODES)
      : [];
  const outcome = await runImport(getDb(), {
    companyId: user.companyId,
    userId: user.id,
    kind,
    fileName: file.name,
    text,
    today: businessToday(),
    snapshotDate: snapshotDate === "" ? undefined : snapshotDate,
    dryRun,
    assumed: dryRun ? { customerCodes: codes("assumeCustomers"), productCodes: codes("assumeProducts") } : undefined,
  });

  if (outcome.wrote) {
    await writeAudit({
      companyId: user.companyId,
      userId: user.id,
      submittedBy: who.ok ? who.name : null,
      action: "import.run",
      entityType: "import_batch",
      entityId: outcome.batchId ?? undefined,
      details: { kind, fileName: file.name, status: outcome.status, rowsAccepted: outcome.rowsAccepted, rowsRejected: outcome.rowsRejected },
    });
    // Redraw the page so the header's "Data last integrated" and the Recent imports table show this import now.
    refresh();
  }

  return {
    fileName: file.name,
    outcome: {
      ...outcome,
      rejections: outcome.rejections.slice(0, SHOWN_ROWS),
      warnings: outcome.warnings.slice(0, SHOWN_ROWS),
      rejectionsHidden: Math.max(0, outcome.rejections.length - SHOWN_ROWS),
      warningsHidden: Math.max(0, outcome.warnings.length - SHOWN_ROWS),
    },
  };
}
