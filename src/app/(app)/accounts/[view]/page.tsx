import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { VIEWS, type View } from "@/demo/accounts";
import { AccountsScreen } from "@/demo/accounts-screen";
import { companyAccounts, type CompanyAccountView } from "@/lib/company-accounts";
import { CompanyAccounts } from "@/components/company-accounts";
import { PageHeading } from "@/components/page-heading";
import { businessToday } from "@/lib/business-date";
import { companyDataSummary } from "@/lib/company-data-summary";

export const metadata: Metadata = { title: "Accounts" };

export function generateStaticParams() {
  return VIEWS.map((v) => ({ view: v.key }));
}

export default async function AccountsPage({ params, searchParams }: { params: Promise<{ view: string }>; searchParams: Promise<{ q?: string | string[] }> }) {
  const { view } = await params;
  if (!VIEWS.some((v) => v.key === view)) notFound();
  const user = await requireUser();
  // Guests (open access) see the synthetic dataset; signed-in users see their own company's accounts once data is imported.
  if (user.guest) return <AccountsScreen view={view as View} basePath="/accounts" />;
  const query = (await searchParams).q;
  const [report, summary] = await Promise.all([companyAccounts(user.companyId, businessToday(), view as CompanyAccountView, typeof query === "string" ? query : ""), companyDataSummary(user.companyId)]);
  return (
    <div><PageHeading eyebrow={`${user.companyName} · Accounts`} title="Company accounts" sub="Sales, balances and follow-up checks from your imported company records." />
      <CompanyAccounts report={report} view={view as CompanyAccountView} canImport={user.role === "owner"} salesThrough={summary.latestInvoice} />
    </div>
  );
}
