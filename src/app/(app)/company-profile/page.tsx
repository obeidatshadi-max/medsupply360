import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { missingFromProfile, yearsInBusiness } from "@/core/company-profile";
import { canEditProfile } from "@/core/permissions";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";
import { companyDataSummary } from "@/lib/company-data-summary";
import { dayText } from "@/lib/format";
import { getProfile, listSuppliers } from "@/server/services/company-profile";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Company profile" };

const n = (v: number) => v.toLocaleString("en-US");

function Card({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-[9px] border border-line bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-brand">{label}</p>
      <p className="mt-2 whitespace-pre-line text-sm">{body === "" ? <span className="text-muted">Not written yet</span> : body}</p>
    </div>
  );
}

export default async function CompanyProfilePage() {
  const user = await requireUser();
  if (user.guest) {
    return <PageHeading eyebrow="Company profile" title="Company profile" sub="Please sign in with a company account to see this page." />;
  }
  const thisYear = Number(businessToday().slice(0, 4));
  const db = getDb();
  const [profile, suppliers, data] = await Promise.all([getProfile(db, user.companyId), listSuppliers(db, user.companyId), companyDataSummary(user.companyId)]);
  if (!profile) return <PageHeading eyebrow="Company profile" title="Company profile" sub="This company was not found." />;
  const edit = canEditProfile(user.role);
  const missing = missingFromProfile(profile);
  const years = yearsInBusiness(profile.founded, thisYear);

  const stats = [
    { label: "Established", value: profile.founded || "—", note: years === null ? "Year not written yet" : `${n(years)} year${years === 1 ? "" : "s"} in business` },
    { label: "Location", value: profile.location || "—", note: profile.address ? profile.address.split("\n")[0]! : "Address not written yet" },
    { label: "Team", value: profile.team || "—", note: "As written by the owner" },
    { label: "Suppliers on the product list", value: n(suppliers.length), note: data.products === 0 ? "No product list loaded yet" : `${n(data.products)} products` },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow={`${user.companyName} · Company profile`}
        title={profile.companyName}
        sub="Who the company is, in the owner's own words, with the suppliers taken from the product list. It is background for the figures, not an accounting report: it holds no sales, margin or customer accounts."
      />
      {missing.length > 0 ? (
        <p className="rounded-lg border border-line bg-white p-3 text-xs text-muted" role="note">
          Not written yet: {missing.join(", ")}.{edit ? " Add them below." : " The owner can add them."}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-[10px] md:gap-[14px] min-[1000px]:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-[9px] border border-line bg-white p-[15px] md:p-[21px]">
            <p className="text-[11px] text-muted md:text-xs">{s.label}</p>
            <p className="my-2 text-2xl tracking-[-0.9px] md:text-[29px]">{s.value}</p>
            <p className="text-[10px] text-muted md:text-[11px]">{s.note}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card label="Who the company serves" body={profile.audience} />
        <Card label="Business purpose" body={profile.purpose} />
        <Card label="Address" body={profile.address} />
      </div>

      <section aria-label="Suppliers">
        <h2 className="text-sm font-semibold">Suppliers on the product list</h2>
        {suppliers.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No supplier names yet. They come from the product list loaded from the ERP.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Supplier</th>
                  <th className="px-3 py-2 text-right font-medium">Products</th>
                  <th className="px-3 py-2 text-right font-medium">Active</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.name} className="border-t border-line">
                    <td className="px-3 py-2">{s.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{n(s.products)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{n(s.activeProducts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-muted">A supplier listed here is a name on the product list. Whether the relationship is current needs confirming.</p>
      </section>

      <section aria-label="Data loaded" className="rounded-lg border border-line bg-white p-4 text-sm">
        <h2 className="font-semibold">What the app holds for this company</h2>
        <p className="mt-1 text-muted">
          {profile.erp ? `Accounting system: ${profile.erp}. ` : ""}
          {n(data.products)} products, {n(data.customers)} customers, {n(data.invoices)} invoices, {n(data.installedUnits)} installed units.
          {data.latestInvoice ? ` Newest invoice: ${dayText(data.latestInvoice)}.` : ""}{" "}
          {user.role === "owner" ? (
            <Link href="/imports" className="text-brand underline underline-offset-2">
              Data channels
            </Link>
          ) : null}
        </p>
      </section>

      {profile.notes !== "" ? <Card label="Notes" body={profile.notes} /> : null}

      {edit ? (
        <section aria-label="Edit the profile">
          <h2 className="mb-2 text-sm font-semibold">Edit the profile</h2>
          <ProfileForm values={{ location: profile.location, address: profile.address, founded: profile.founded, team: profile.team, audience: profile.audience, purpose: profile.purpose, erp: profile.erp, notes: profile.notes }} />
          {profile.updatedAt ? (
            <p className="mt-2 text-xs text-muted">
              Last changed {dayText(profile.updatedAt.toISOString().slice(0, 10))}
              {profile.updatedBy ? ` by ${profile.updatedBy}` : ""}.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
