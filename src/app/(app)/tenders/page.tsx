import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { requireUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Tenders" };

export default async function TendersPage() {
  const user = await requireUser("tender");
  return (
    <div>
      <PageHeading
        eyebrow={`${user.companyName} · Tenders`}
        title="Tenders"
        sub="The tender tracker is being set up. Once it is ready, the tender department and finance will update each tender here as it moves from announcement to payment, and the owner will follow every stage."
      />
    </div>
  );
}
