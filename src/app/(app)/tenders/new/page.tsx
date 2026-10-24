import { AdvancedGate } from "@/components/advanced-gate";
import { levelAllows } from "@/core/level";
import { currentLevel } from "@/lib/level";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { canEditTender } from "@/core/permissions";
import { requireUser } from "@/lib/auth/current-user";
import { NewTenderForm } from "./new-tender-form";

export const metadata: Metadata = { title: "Record a tender" };

export default async function NewTenderPage() {
  const user = await requireUser("tender");
  if (!levelAllows(await currentLevel(), user.role, "/tenders")) return <AdvancedGate title="Tenders" />;
  if (!canEditTender(user.role)) redirect("/tenders");
  return (
    <div>
      <PageHeading
        eyebrow={`${user.companyName} · Tenders`}
        title="Record a tender"
        sub="Start with what you know. You can add the bid, award and contract details later as the tender moves forward."
      />
      <NewTenderForm />
    </div>
  );
}
