import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { AuthCard, InfoNote } from "@/components/auth-card";
import { signupInviteCode } from "@/lib/domain/account";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <AuthCard title="Create your account" subtitle="You become the owner of your company's workspace. An invitation code is required.">
      <Suspense fallback={null}>
        <SignupBody />
      </Suspense>
      <p className="mt-4 text-center text-sm text-muted">
        Already have an account?{" "}
        <a className="underline" href="/login">
          Sign in
        </a>
      </p>
    </AuthCard>
  );
}

/** Read at request time so SIGNUP_INVITE_CODE is taken from each deployment, not baked in at build. */
async function SignupBody() {
  await connection();
  if (!signupInviteCode()) return <InfoNote>Sign-up is by invitation only. Ask your administrator for access.</InfoNote>;
  return <SignupForm />;
}
