"use client";

import { useActionState } from "react";
import { SubmitterField } from "@/components/submitter-field";
import { LIMITS, NAME_MAX, type ProfileValues } from "@/core/company-profile";
import { saveProfileAction, type ProfileFormState } from "@/server/actions/company-profile";

const field = "mt-1 block w-full rounded-md border border-line bg-white px-3 py-2 text-sm";

export function ProfileForm({ values }: { values: ProfileValues }) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(saveProfileAction, {});
  return (
    <form action={action} className="space-y-4 rounded-lg border border-line bg-surface p-5">
      <label className="block text-sm font-medium">
        Company name
        <input name="companyName" required minLength={2} maxLength={NAME_MAX} defaultValue={values.companyName} placeholder="Your company, as you want it shown" className={field} />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-medium">
          Location
          <input name="location" maxLength={LIMITS.location} defaultValue={values.location} placeholder="Jordan" className={field} />
        </label>
        <label className="text-sm font-medium">
          Year founded
          <input name="founded" inputMode="numeric" maxLength={4} defaultValue={values.founded} placeholder="2008" className={field} />
        </label>
        <label className="text-sm font-medium">
          Team
          <input name="team" maxLength={LIMITS.team} defaultValue={values.team} placeholder="About 20 people" className={field} />
        </label>
        <label className="text-sm font-medium">
          Accounting system
          <input name="erp" maxLength={LIMITS.erp} defaultValue={values.erp} placeholder="Alpha ERP" className={field} />
        </label>
      </div>
      <label className="block text-sm font-medium">
        Address
        <textarea name="address" rows={3} maxLength={LIMITS.address} defaultValue={values.address} className={field} />
      </label>
      <label className="block text-sm font-medium">
        Who the company serves
        <textarea name="audience" rows={3} maxLength={LIMITS.audience} defaultValue={values.audience} className={field} />
      </label>
      <label className="block text-sm font-medium">
        Business purpose
        <textarea name="purpose" rows={3} maxLength={LIMITS.purpose} defaultValue={values.purpose} className={field} />
      </label>
      <label className="block text-sm font-medium">
        Notes
        <textarea name="notes" rows={3} maxLength={LIMITS.notes} defaultValue={values.notes} placeholder="Anything a new reader should know, and what still needs confirming" className={field} />
      </label>
      <SubmitterField />
      {state.error ? (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="text-sm text-brand">
          Saved.
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="rounded-[7px] bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-[#125747] disabled:opacity-60">
        {pending ? "Saving…" : "Save the profile"}
      </button>
    </form>
  );
}
