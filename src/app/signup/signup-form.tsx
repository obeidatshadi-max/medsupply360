"use client";

import { useActionState } from "react";
import { signupAction, type SignupState } from "@/server/actions/account";
import { ErrorNote, Field, buttonClass, fieldClass } from "@/components/auth-card";

export function SignupForm() {
  const [state, action, pending] = useActionState<SignupState, FormData>(signupAction, {});
  const v = state.values;
  return (
    <form action={action} className="mt-5 space-y-3" noValidate>
      <Field id="fullName" label="Your name">
        <input id="fullName" name="fullName" autoComplete="name" required defaultValue={v?.fullName} className={fieldClass} />
      </Field>
      <Field id="companyName" label="Company name">
        <input id="companyName" name="companyName" autoComplete="organization" required defaultValue={v?.companyName} className={fieldClass} />
      </Field>
      <Field id="email" label="Email">
        <input id="email" name="email" type="email" autoComplete="username" required defaultValue={v?.email} className={fieldClass} />
      </Field>
      <Field id="password" label="Password" hint="At least 10 characters.">
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className={fieldClass} />
      </Field>
      <Field id="inviteCode" label="Invitation code">
        <input id="inviteCode" name="inviteCode" autoComplete="off" required className={fieldClass} />
      </Field>
      {/* Honeypot: hidden from people, tempting to bots. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
