import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DealSimulator } from "@/components/deal-report";
import { PageHeading } from "@/components/page-heading";
import type { SimInputs } from "@/core/deal-margin";
import { canSimulateDeal, homePath } from "@/core/permissions";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth/current-user";
import { loadPolicy } from "@/server/services/deal-margin";

export const metadata: Metadata = { title: "Pre-bid simulator" };

/** Starting values are neutral zeros plus the company's own financing rate. Nothing here is a company policy we made up. */
export default async function SimulatePage() {
  const user = await requireUser("business");
  if (user.guest) return <PageHeading eyebrow="Pre-bid simulator" title="Pre-bid simulator" sub="Please sign in with a company account to use the simulator." />;
  if (!canSimulateDeal(user.role)) redirect(homePath(user.role));
  const policy = await loadPolicy(getDb(), user.companyId);
  const defaults: SimInputs = {
    price: 0, discountPct: 0, supplierCost: 0, freightCustoms: 0, installation: 0, warrantyProvision: 0, commissionPct: 0, paymentDays: 90,
    financingRateAnnualPct: policy.financingRateAnnualPct, rebate: 0, rebateEligibleAndEarned: false,
  };
  return (
    <div>
      <PageHeading
        eyebrow={`${user.companyName} · Deal margins`}
        title="Pre-bid simulator"
        sub="Test a price before you commit. Type your assumptions: the margin, the effect of each assumption and the lowest safe price update as you type. Nothing is saved and no deal or accounting record is touched."
      />
      <p className="mb-3 text-xs text-muted">
        The target margin is the company&rsquo;s approved minimum: {policy.minContributionMarginPct === null ? "not set yet, so no minimum price is calculated. The owner can set it on the Deal margins page." : `${policy.minContributionMarginPct}%.`}{" "}
        <Link href="/deals" className="underline">
          Back to deal margins
        </Link>
      </p>
      <DealSimulator defaults={defaults} target={policy.minContributionMarginPct} />
    </div>
  );
}
