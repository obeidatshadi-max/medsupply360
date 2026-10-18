"use client";

import { useActionState } from "react";
import { addUserAction, type AddUserState } from "@/server/actions/users";
import { ASSIGNABLE_ROLES, ROLE_LABEL } from "@/core/permissions";

const field = "mt-1 block w-full rounded-md border border-line bg-white px-3 py-2 text-sm";

export function AddUserForm() {
  const [state, action, pending] = useActionState<AddUserState, FormData>(addUserAction, {});
  return (
    <form action={action} className="space-y-4 rounded-lg border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold">Add a person</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="fullName" className="text-sm font-medium">Full name</label>
          <input id="fullName" name="fullName" required maxLength={200} autoComplete="off" className={field} />
        </div>
        <div>
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" required maxLength={255} autoComplete="off" className={field} />
        </div>
        <div>
          <label htmlFor="role" className="text-sm font-medium">Access</label>
          <select id="role" name="role" required defaultValue="" className={field}>
            <option value="" disabled>Choose…</option>
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r].name} · {ROLE_LABEL[r].note}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="password" className="text-sm font-medium">First password</label>
          <input id="password" name="password" type="password" required minLength={12} maxLength={200} autoComplete="new-password" className={field} />
          <p className="mt-1 text-xs text-muted">At least 12 characters. Give it to the person; they can change it with &ldquo;Forgot password&rdquo;.</p>
        </div>
      </div>
      {state.error ? <p role="alert" className="text-sm text-bad">{state.error}</p> : null}
      {state.added ? <p role="status" className="text-sm text-brand">Added {state.added}. They can sign in now.</p> : null}
      <button type="submit" disabled={pending} className="rounded-[7px] bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-[#125747] disabled:opacity-60">
        {pending ? "Adding…" : "Add person"}
      </button>
    </form>
  );
}
