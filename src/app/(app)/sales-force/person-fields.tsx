"use client";

import { useState } from "react";

export const fieldClass = "mt-1 block w-full rounded-md border border-line bg-white px-3 py-2 text-sm";

export type PersonValues = {
  name: string;
  email: string;
  suppliers: string[];
  monthlySalesTarget: string;
  newAccountsTarget: string;
  visitsPerWeek: string;
};

export const emptyPerson: PersonValues = { name: "", email: "", suppliers: [], monthlySalesTarget: "", newAccountsTarget: "", visitsPerWeek: "" };

/** The fields of one sales person, shared by "Add a person" and the edit form. `supplierOptions` are the suppliers found in the product list. */
export function PersonFields({ values, supplierOptions }: { values: PersonValues; supplierOptions: string[] }) {
  // A saved supplier that is no longer in the product list stays visible so it is not dropped by accident.
  const options = [...new Set([...supplierOptions, ...values.suppliers])].sort((a, b) => a.localeCompare(b));
  const [chosen, setChosen] = useState(new Set(values.suppliers));
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="sp-name" className="text-sm font-medium">
            Name
          </label>
          <input id="sp-name" name="name" required minLength={2} maxLength={80} defaultValue={values.name} autoComplete="off" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="sp-email" className="text-sm font-medium">
            Email (optional)
          </label>
          <input id="sp-email" name="email" type="email" maxLength={255} defaultValue={values.email} autoComplete="off" className={fieldClass} />
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Supplier companies they represent</legend>
        {options.length === 0 ? (
          <p className="mt-1 text-xs text-muted">No supplier found yet. Import the product list with a supplier column to choose from it.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {options.map((s) => (
              <label key={s} className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs ${chosen.has(s) ? "border-brand bg-brand-soft" : "border-line bg-white"}`}>
                <input
                  type="checkbox"
                  name="suppliers"
                  value={s}
                  checked={chosen.has(s)}
                  onChange={(e) => setChosen((prev) => (e.target.checked ? new Set(prev).add(s) : new Set([...prev].filter((x) => x !== s))))}
                />
                {s}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">What you expect of this person (all optional)</legend>
        <div className="mt-2 grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="sp-target" className="text-xs text-muted">
              Monthly sales target (JOD)
            </label>
            <input id="sp-target" name="monthlySalesTarget" inputMode="decimal" defaultValue={values.monthlySalesTarget} autoComplete="off" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="sp-accounts" className="text-xs text-muted">
              New accounts per month
            </label>
            <input id="sp-accounts" name="newAccountsTarget" inputMode="numeric" defaultValue={values.newAccountsTarget} autoComplete="off" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="sp-visits" className="text-xs text-muted">
              Customer visits per week
            </label>
            <input id="sp-visits" name="visitsPerWeek" inputMode="numeric" defaultValue={values.visitsPerWeek} autoComplete="off" className={fieldClass} />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
