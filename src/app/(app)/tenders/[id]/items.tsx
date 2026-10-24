"use client";

import { useActionState, useState } from "react";
import { saveTenderItemsAction, type ItemsFormState } from "@/server/actions/tender-items";
import { SubmitterField } from "@/components/submitter-field";
import { cleanItems, itemTotals, lineTotal, type ItemForm, type TenderItem } from "@/core/tender-items";
import { jod } from "@/lib/format";
import { fieldClass } from "../tender-fields";

const blank = (): ItemForm => ({ itemName: "", quantity: "", unit: "", estimatedUnitPrice: "", ourUnitPrice: "" });
const asForm = (i: TenderItem): ItemForm => ({
  itemName: i.itemName,
  quantity: String(i.quantity),
  unit: i.unit ?? "",
  estimatedUnitPrice: i.estimatedUnitPrice === null ? "" : String(i.estimatedUnitPrice),
  ourUnitPrice: i.ourUnitPrice === null ? "" : String(i.ourUnitPrice),
});

function TotalsLine({ count, bid, estimated, unpriced }: { count: number; bid: number | null; estimated: number | null; unpriced: number }) {
  if (count === 0) return <>No lines.</>;
  return (
    <>
      {bid === null ? `Our bid total is not complete: ${unpriced} line${unpriced === 1 ? "" : "s"} without our price.` : `Our bid total ${jod(bid)}.`}
      {estimated === null ? "" : ` Authority estimate total ${jod(estimated)}.`}
    </>
  );
}

/** Read-only table of the item lines, for roles that may not edit them. */
export function ItemsTable({ items }: { items: TenderItem[] }) {
  const t = itemTotals(items);
  return (
    <section aria-label="Item lines" className="space-y-2 rounded-lg border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold">Item lines</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted">No item lines recorded.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1 pr-3 font-medium">Item</th>
                <th className="py-1 pr-3 text-right font-medium">Quantity</th>
                <th className="py-1 pr-3 text-right font-medium">Authority estimate</th>
                <th className="py-1 pr-3 text-right font-medium">Our price</th>
                <th className="py-1 text-right font-medium">Our line total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i, n) => {
                const total = lineTotal(i.quantity, i.ourUnitPrice);
                return (
                  <tr key={n} className="border-t border-line">
                    <td className="py-1 pr-3">{i.itemName}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">
                      {i.quantity}
                      {i.unit ? ` ${i.unit}` : ""}
                    </td>
                    <td className="py-1 pr-3 text-right tabular-nums">{i.estimatedUnitPrice === null ? "—" : jod(i.estimatedUnitPrice)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{i.ourUnitPrice === null ? "—" : jod(i.ourUnitPrice)}</td>
                    <td className="py-1 text-right tabular-nums">{total === null ? "—" : jod(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">
            <TotalsLine {...t} />
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * Edits the whole list of lines at once. When every line has our price the tender's bid value follows the lines, and when
 * every line has the authority's estimate the estimated value does, so they never disagree.
 */
export function ItemsEditor({ tenderId, items }: { tenderId: string; items: TenderItem[] }) {
  const [state, action, pending] = useActionState<ItemsFormState, FormData>(saveTenderItemsAction, {});
  const [rows, setRows] = useState<ItemForm[]>(items.length ? items.map(asForm) : [blank()]);
  const set = (i: number, key: keyof ItemForm, v: string) => setRows((r) => r.map((x, k) => (k === i ? { ...x, [key]: v } : x)));
  const cleaned = cleanItems(rows);
  const totals = cleaned.ok ? itemTotals(cleaned.items) : null;
  const cell = `${fieldClass} !mt-0`;

  return (
    <form action={action} className="space-y-4 rounded-lg border border-line bg-surface p-5">
      <input type="hidden" name="tenderId" value={tenderId} />
      <h2 className="text-sm font-semibold">Item lines</h2>
      <p className="text-xs text-muted">One row per item the authority asks for. Prices are per unit, in JOD. Leave a price empty if it is not known yet.</p>
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="grid gap-2 rounded-md border border-line bg-white p-3 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] md:items-end">
            <label className="text-xs text-muted">
              Item
              <input name="itemName" value={r.itemName} onChange={(e) => set(i, "itemName", e.target.value)} maxLength={300} autoComplete="off" className={cell} />
            </label>
            <label className="text-xs text-muted">
              Quantity
              <input name="quantity" value={r.quantity} onChange={(e) => set(i, "quantity", e.target.value)} inputMode="decimal" autoComplete="off" className={cell} />
            </label>
            <label className="text-xs text-muted">
              Unit
              <input name="unit" value={r.unit} onChange={(e) => set(i, "unit", e.target.value)} maxLength={30} autoComplete="off" className={cell} />
            </label>
            <label className="text-xs text-muted">
              Authority estimate
              <input name="estimatedUnitPrice" value={r.estimatedUnitPrice} onChange={(e) => set(i, "estimatedUnitPrice", e.target.value)} inputMode="decimal" autoComplete="off" className={cell} />
            </label>
            <label className="text-xs text-muted">
              Our price
              <input name="ourUnitPrice" value={r.ourUnitPrice} onChange={(e) => set(i, "ourUnitPrice", e.target.value)} inputMode="decimal" autoComplete="off" className={cell} />
            </label>
            <button
              type="button"
              onClick={() => setRows((x) => (x.length === 1 ? [blank()] : x.filter((_, k) => k !== i)))}
              className="rounded-[7px] border border-line bg-white px-3 py-2 text-sm hover:border-brand"
              aria-label={`Remove line ${i + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setRows((x) => [...x, blank()])} className="rounded-[7px] border border-line bg-white px-3 py-2 text-sm hover:border-brand">
        Add a line
      </button>
      {totals ? (
        <p className="text-xs text-muted">
          <TotalsLine {...totals} />
        </p>
      ) : (
        <p className="text-xs text-bad">{cleaned.ok ? "" : cleaned.error}</p>
      )}
      <SubmitterField />
      {state.error ? (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="text-sm text-brand">
          {state.message}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="rounded-[7px] border border-line bg-white px-4 py-2 text-sm font-semibold hover:border-brand disabled:opacity-60">
        {pending ? "Saving…" : "Save item lines"}
      </button>
    </form>
  );
}
