"use server";

import { z } from "zod";
import { getDb } from "@/db/client";
import { MAX_HEADING, saveColumnChoice, takeOverColumnChoices } from "@/db/column-choices";
import type { Remembered } from "@/core/import/column-map";
import { canImportKind } from "@/core/permissions";
import { IMPORT_ORDER } from "@/core/import/detect";
import { SPECS, type ImportKind } from "@/core/import/specs";
import { getCurrentUser } from "@/lib/auth/current-user";

const kindSchema = z.enum(Object.keys(SPECS) as [ImportKind, ...ImportKind[]]);
const choiceSchema = z.object({
  kind: kindSchema,
  fieldKey: z.string().min(1).max(64),
  heading: z.string().max(MAX_HEADING * 4),
  previous: z.string().max(MAX_HEADING * 4).optional(),
});

/** People who can upload a file type can also teach the app its column names. */
async function uploader() {
  const user = await getCurrentUser();
  if (!user || user.guest || (user.role !== "owner" && user.role !== "tender" && user.role !== "maintenance")) return null;
  return user;
}

/** Saves one column choice for the whole company (an empty heading forgets the field's choice). */
export async function saveColumnChoiceAction(input: { kind: ImportKind; fieldKey: string; heading: string; previous?: string }): Promise<{ ok: boolean }> {
  const user = await uploader();
  const parsed = choiceSchema.safeParse(input);
  if (!user || !parsed.success || !canImportKind(user.role, parsed.data.kind)) return { ok: false };
  const ok = await saveColumnChoice(getDb(), { companyId: user.companyId, userId: user.id, ...parsed.data });
  return { ok };
}

/** Moves choices an older version kept in this browser to the company, once. Only file types this person may upload. */
export async function takeOverBrowserChoicesAction(remembered: Remembered): Promise<{ added: number }> {
  const user = await uploader();
  if (!user || remembered === null || typeof remembered !== "object" || Array.isArray(remembered)) return { added: 0 };
  const kinds = IMPORT_ORDER.filter((k) => canImportKind(user.role, k));
  const clean: Remembered = {};
  for (const kind of kinds) {
    const forKind = (remembered as Record<string, unknown>)[kind];
    if (forKind === null || typeof forKind !== "object") continue;
    clean[kind] = Object.fromEntries(
      Object.entries(forKind as Record<string, unknown>)
        .filter((e): e is [string, string] => typeof e[1] === "string" && e[0].length <= MAX_HEADING * 4 && e[1].length <= 64),
    );
  }
  const added = await takeOverColumnChoices(getDb(), { companyId: user.companyId, userId: user.id, kinds, remembered: clean });
  return { added };
}
