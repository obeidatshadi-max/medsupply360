"use client";

import { useActionState } from "react";
import { addInvoiceAction, deleteInvoiceAction, setCollectedAction, type FinanceFormState } from "@/server/actions/tender-finance";
import { SubmitterField } from "@/components/submitter-field";
import { checkAgainstErp, type ErpCheck, type ErpInvoiceFacts } from "@/core/tender-erp";
import { paymentSummary } from "@/core/tender-money";
import type { InvoiceRow } from "@/server/services/tender-finance";
import { dayText, jod } from "@/lib/format";
import { fieldClass } from "../tender-fields";

function Message({ state }: { state: FinanceFormState }) {
  if (state.error)
    return (
      <p role="alert" className="text-sm text-bad">
        {state.error}
      </p>
    );
  if (state.saved)
    return (
      <p role="status" className="text-sm text-brand">
        Saved.
      </p>
    );
  return null;
}

function ErpNote({ check }: { check: ErpCheck }) {
  if (check.kind === "not-found") return <p className="mt-1 text-xs text-muted">Not in the ERP files, so this payment status is your own record only.</p>;
  if (check.kind === "no-snapshot") return <p className="mt-1 text-xs text-muted">In the ERP files, but no unpaid-invoice file has been imported to compare with.</p>;
  if (check.kind === "agrees") return <p className="mt-1 text-xs text-muted">ERP agrees ({check.remaining === 0 ? "paid" : `${jod(check.remaining)} unpaid`} on {dayText(check.snapshotDate)}).</p>;
  return (
    <p className="mt-1 text-xs text-warn">
      ERP differs: {check.remaining === 0 ? "it shows this invoice paid" : `it shows ${jod(check.remaining)} unpaid`} on {dayText(check.snapshotDate)}. Check which record is right.
    </p>
  );
}

function InvoiceItem({ tenderId, inv, erp, checked, canEdit }: { tenderId: string; inv: InvoiceRow; erp: ErpInvoiceFacts | undefined; checked: boolean; canEdit: boolean }) {
  const [state, action, pending] = useActionState<FinanceFormState, FormData>(setCollectedAction, {});
  const left = Math.max(0, Math.round((inv.amount - inv.collected) * 1000) / 1000);
  return (
    <li className="rounded-lg border border-line bg-white p-4">
      <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span>
          <b>{inv.invoiceNo}</b> · <span className="text-xs text-muted">{dayText(inv.invoiceDate)}</span>
        </span>
        <span className="tabular-nums">{jod(inv.amount)}</span>
      </p>
      <p className="mt-1 text-xs text-muted">
        Collected {jod(inv.collected)}
        {inv.lastCollectedOn ? ` (latest payment ${dayText(inv.lastCollectedOn)})` : ""} ·{" "}
        <span className={left === 0 ? "text-brand" : "text-bad"}>{left === 0 ? "Paid in full" : `${jod(left)} still unpaid`}</span>
      </p>
      {checked ? <ErpNote check={checkAgainstErp(left, erp)} /> : null}
      {canEdit ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs underline underline-offset-2">Record payment or remove</summary>
          <form action={action} className="mt-3 grid gap-3 md:grid-cols-3">
            <input type="hidden" name="tenderId" value={tenderId} />
            <input type="hidden" name="invoiceId" value={inv.id} />
            <div>
              <label className="text-sm font-medium">Total collected so far (JOD)</label>
              <input name="collected" required inputMode="decimal" defaultValue={String(inv.collected)} autoComplete="off" className={fieldClass} />
            </div>
            <div>
              <label className="text-sm font-medium">Date of latest payment</label>
              <input name="collectedOn" type="date" defaultValue={inv.lastCollectedOn ?? ""} className={fieldClass} />
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={pending} className="rounded-[7px] border border-line bg-white px-3 py-2 text-xs font-semibold hover:border-brand disabled:opacity-60">
                {pending ? "Saving…" : "Save payment"}
              </button>
            </div>
            <div className="md:col-span-3">
              <SubmitterField />
            </div>
            <div className="md:col-span-3">
              <Message state={state} />
            </div>
          </form>
          <form action={deleteInvoiceAction} className="mt-2 flex flex-wrap items-center gap-2">
            <input type="hidden" name="tenderId" value={tenderId} />
            <input type="hidden" name="invoiceId" value={inv.id} />
            <SubmitterField compact />
            <button type="submit" className="text-xs text-bad underline underline-offset-2">
              Remove this invoice (entered by mistake)
            </button>
          </form>
        </details>
      ) : null}
    </li>
  );
}

export function Payments({ tenderId, rows, erp, canEdit, canAdd }: { tenderId: string; rows: InvoiceRow[]; erp: Record<string, ErpInvoiceFacts> | null; canEdit: boolean; canAdd: boolean }) {
  const [state, action, pending] = useActionState<FinanceFormState, FormData>(addInvoiceAction, {});
  const sum = paymentSummary(rows.map((r) => ({ amount: r.amount, collected: r.collected })));
  return (
    <section aria-label="Invoices and payments" className="space-y-3">
      <h2 className="text-sm font-semibold">Invoices and payments</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No invoice recorded yet. A tender can be marked Collected once its invoices are recorded and paid in full.</p>
      ) : (
        <p className="text-sm">
          Invoiced <b className="tabular-nums">{jod(sum.invoiced)}</b> · Collected <b className="tabular-nums">{jod(sum.collected)}</b> · Still unpaid{" "}
          <b className="tabular-nums">{jod(sum.outstanding)}</b>
        </p>
      )}
      <ul className="space-y-2">
        {rows.map((inv) => (
          <InvoiceItem key={inv.id} tenderId={tenderId} inv={inv} erp={erp ? erp[inv.invoiceNo] : undefined} checked={erp !== null} canEdit={canEdit} />
        ))}
      </ul>
      {canEdit && canAdd ? (
        <form action={action} className="space-y-3 rounded-lg border border-line bg-surface p-5">
          <input type="hidden" name="tenderId" value={tenderId} />
          <p className="text-sm font-medium">Add an invoice</p>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium">Invoice number</label>
              <input name="invoiceNo" required maxLength={80} autoComplete="off" className={fieldClass} />
            </div>
            <div>
              <label className="text-sm font-medium">Invoice date</label>
              <input name="invoiceDate" type="date" required className={fieldClass} />
            </div>
            <div>
              <label className="text-sm font-medium">Amount (JOD)</label>
              <input name="amount" required inputMode="decimal" autoComplete="off" className={fieldClass} />
            </div>
          </div>
          <SubmitterField />
          <Message state={state} />
          <button type="submit" disabled={pending} className="rounded-[7px] border border-line bg-white px-4 py-2 text-sm font-semibold hover:border-brand disabled:opacity-60">
            {pending ? "Saving…" : "Add invoice"}
          </button>
        </form>
      ) : null}
      {canEdit && !canAdd ? <p className="text-xs text-muted">Invoices can be recorded once the tender is contracted.</p> : null}
    </section>
  );
}
