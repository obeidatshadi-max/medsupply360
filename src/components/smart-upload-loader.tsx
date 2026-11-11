import { getDb } from "@/db/client";
import { loadColumnChoices } from "@/db/column-choices";
import type { ImportKind } from "@/core/import/specs";
import { SmartUpload } from "./smart-upload";

/** The upload screen with the company's saved column choices, so every device and every uploader reads files alike. */
export async function SmartUploadWithChoices({ allowed, noun, companyId }: { allowed: readonly ImportKind[]; noun: string; companyId: string }) {
  const choices = await loadColumnChoices(getDb(), companyId);
  return <SmartUpload companyId={companyId} allowed={allowed} noun={noun} initialChoices={choices} />;
}
