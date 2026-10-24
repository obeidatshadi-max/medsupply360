import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { requireUser } from "@/lib/auth/current-user";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const user = await requireUser("any");
  return (
    <div className="space-y-6">
      <PageHeading eyebrow={`${user.companyName} · My account`} title="Change password" sub={`Signed in as ${user.email}.`} />
      <ChangePasswordForm />
    </div>
  );
}
