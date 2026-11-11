/**
 * The company's saved column choices (see `importColumnChoices`): read them for the upload screen, save one, and take
 * over choices an older version of the app kept in one browser. Headings are stored the way the importer compares them
 * (`norm`), so "Cust. No" and "cust no" are one choice.
 */
import { and, eq } from "drizzle-orm";
import type { getDb } from "@/db/client";
import { importColumnChoices } from "@/db/schema";
import type { Remembered } from "@/core/import/column-map";
import { SPECS, type ImportKind } from "@/core/import/specs";
import { norm } from "@/core/import/validate";

type Db = ReturnType<typeof getDb>;

export const MAX_HEADING = 255;
/** Choices one browser can hand over at once; a person makes a handful per file type. */
export const MAX_TAKEOVER = 500;

const isField = (kind: ImportKind, fieldKey: string) => SPECS[kind].fields.some((f) => f.key === fieldKey);

export async function loadColumnChoices(db: Db, companyId: string): Promise<Remembered> {
  const rows = await db
    .select({ kind: importColumnChoices.kind, heading: importColumnChoices.heading, fieldKey: importColumnChoices.fieldKey })
    .from(importColumnChoices)
    .where(eq(importColumnChoices.companyId, companyId));
  const out: Remembered = {};
  for (const r of rows) {
    if (!isField(r.kind, r.fieldKey)) continue;
    (out[r.kind] ??= {})[r.heading] = r.fieldKey;
  }
  return out;
}

/**
 * Saves that `heading` holds `fieldKey` for this file type, and forgets `previous` (the heading chosen before for the
 * same field). An empty `heading` only forgets. Returns false for a field the type does not have.
 */
export async function saveColumnChoice(
  db: Db,
  input: { companyId: string; userId: string; kind: ImportKind; fieldKey: string; heading: string; previous?: string },
): Promise<boolean> {
  if (!isField(input.kind, input.fieldKey)) return false;
  const heading = norm(input.heading).slice(0, MAX_HEADING);
  const previous = input.previous ? norm(input.previous).slice(0, MAX_HEADING) : "";
  await db.transaction(async (tx) => {
    const scope = and(eq(importColumnChoices.companyId, input.companyId), eq(importColumnChoices.kind, input.kind));
    if (previous !== "" && previous !== heading) await tx.delete(importColumnChoices).where(and(scope, eq(importColumnChoices.heading, previous)));
    if (heading === "") return;
    await tx
      .insert(importColumnChoices)
      .values({ companyId: input.companyId, kind: input.kind, heading, fieldKey: input.fieldKey, updatedBy: input.userId })
      .onConflictDoUpdate({
        target: [importColumnChoices.companyId, importColumnChoices.kind, importColumnChoices.heading],
        set: { fieldKey: input.fieldKey, updatedBy: input.userId, updatedAt: new Date() },
      });
  });
  return true;
}

/**
 * Takes over choices kept in a browser by an older version. A choice already saved for the company wins; only the
 * file types in `kinds` (the ones this person may upload) are taken. Returns how many were added.
 */
export async function takeOverColumnChoices(db: Db, input: { companyId: string; userId: string; kinds: readonly ImportKind[]; remembered: Remembered }): Promise<number> {
  const values = input.kinds.flatMap((kind) =>
    Object.entries(input.remembered[kind] ?? {})
      .filter(([heading, fieldKey]) => typeof fieldKey === "string" && isField(kind, fieldKey) && norm(heading) !== "")
      .map(([heading, fieldKey]) => ({ companyId: input.companyId, kind, heading: norm(heading).slice(0, MAX_HEADING), fieldKey, updatedBy: input.userId })),
  ).slice(0, MAX_TAKEOVER);
  if (values.length === 0) return 0;
  const added = await db.insert(importColumnChoices).values(values).onConflictDoNothing().returning({ heading: importColumnChoices.heading });
  return added.length;
}
