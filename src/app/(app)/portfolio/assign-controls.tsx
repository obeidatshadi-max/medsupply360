"use client";

import { useActionState, useRef } from "react";
import { assignProductAction, assignSupplierAction, type AssignState } from "@/server/actions/sales-force";

export type PersonChoice = { id: string; name: string; active: boolean };

const select = "rounded-md border border-line bg-white px-2 py-1 text-xs";

/** Turned-off people appear only while they already hold the item. */
const shown = (people: PersonChoice[], currentId: string | null) => people.filter((p) => p.active || p.id === currentId);

/** One product's sales person. Saves as soon as a person is chosen, so the CEO can go down the list quickly. */
export function ProductAssign({ productId, currentId, people }: { productId: string; currentId: string | null; people: PersonChoice[] }) {
  const [state, action] = useActionState<AssignState, FormData>(assignProductAction, {});
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={action} className="flex items-center gap-2">
      <input type="hidden" name="productId" value={productId} />
      <select name="personId" defaultValue={currentId ?? ""} onChange={() => form.current?.requestSubmit()} aria-label="Sales person" className={select}>
        <option value="">Not assigned</option>
        {shown(people, currentId).map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.active ? "" : " (turned off)"}
          </option>
        ))}
      </select>
      {state.error ? (
        <span role="alert" className="text-xs text-bad">
          {state.error}
        </span>
      ) : state.saved ? (
        <span role="status" className="text-xs text-brand">
          ✓ Saved
        </span>
      ) : null}
    </form>
  );
}

/** Gives every product of one supplier to one person in one click. */
export function SupplierAssign({ supplierName, people }: { supplierName: string; people: PersonChoice[] }) {
  const [state, action, pending] = useActionState<AssignState & { count?: number }, FormData>(assignSupplierAction, {});
  const active = people.filter((p) => p.active);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 text-xs">
      <input type="hidden" name="supplierName" value={supplierName} />
      <label htmlFor={`sup-${supplierName}`} className="font-medium">
        Assign all of {supplierName} to
      </label>
      <select id={`sup-${supplierName}`} name="personId" defaultValue="" className={select}>
        <option value="">Nobody (clear)</option>
        {active.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className="rounded-[7px] border border-line bg-white px-3 py-1 font-semibold hover:border-brand disabled:opacity-60">
        {pending ? "Saving…" : "Assign all"}
      </button>
      {state.error ? (
        <span role="alert" className="text-bad">
          {state.error}
        </span>
      ) : state.saved ? (
        <span role="status" className="text-brand">
          ✓ {state.count} product{state.count === 1 ? "" : "s"} updated
        </span>
      ) : null}
    </form>
  );
}
