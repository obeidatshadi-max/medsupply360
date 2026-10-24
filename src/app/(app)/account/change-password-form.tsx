"use client";

import { useActionState } from "react";
import { changePasswordAction, type ChangePasswordState } from "@/server/actions/change-password";
import { ErrorNote, Field, InfoNote, buttonClass, fieldClass } from "@/components/auth-card";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="max-w-sm space-y-3" noValidate>
      <Field id="current" label="Current password">
        <input id="current" name="current" type="password" autoComplete="current-password" required className={fieldClass} />
      </Field>
      <Field id="password" label="New password" hint="At least 10 characters.">
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className={fieldClass} />
      </Field>
      <Field id="confirm" label="Repeat new password">
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required className={fieldClass} />
      </Field>
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      {state.done ? <InfoNote>Password changed. Other devices are signed out.</InfoNote> : null}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
