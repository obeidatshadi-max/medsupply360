"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/components/password-input";
import { loginAction, type LoginState } from "@/server/actions/auth";

const MESSAGES = {
  invalid: "Email or password is incorrect.",
  invalidInput: "Enter a valid email address and your password.",
  locked: "Too many failed attempts. Wait 15 minutes and try again.",
} as const;

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const field = "mt-1 block w-full rounded-md border border-line bg-white px-3 py-2 text-sm";
  return (
    <form action={action} className="mt-5 space-y-3" noValidate>
      <div>
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email} className={field} />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <PasswordInput id="password" name="password" autoComplete="current-password" required className={field} />
      </div>
      {state.error ? (
        <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">
          {MESSAGES[state.error]}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
