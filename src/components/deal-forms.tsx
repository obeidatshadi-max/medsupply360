"use client";

import { startTransition, useActionState } from "react";
import { SubmitterField } from "@/components/submitter-field";
import { readUploadedFile } from "@/core/import/read-file";
import { COST_FILE_COLUMNS } from "@/core/deal-margin/import";
import { COST_LABEL, REBATE_LABEL, COST_CATEGORIES } from "@/core/deal-margin/types";
import {
  addDealAction,
  addEntryAction,
  addRebateAction,
  checkOutcomesAction,
  importCostsAction,
  reviewEntryAction,
  savePolicyAction,
  startActionAction,
  type DealFormState,
} from "@/server/actions/deal-margin";

const field = "mt-1 block w-full rounded-md border border-line bg-white px-3 py-2 text-sm";
const submit = "rounded-[7px] bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-[#125747] disabled:opacity-60";
const small = "rounded-md border border-brand px-3 py-1.5 text-xs font-semibold text-brand disabled:opacity-60";

function Status({ state }: { state: DealFormState }) {
  return (
    <>
      {state.error ? (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="text-sm text-brand">
          {state.message ?? "Saved."}
        </p>
      ) : null}
    </>
  );
}

const Money = ({ name, label, hint, required = false }: { name: string; label: string; hint?: string; required?: boolean }) => (
  <label className="text-sm font-medium">
    {label}
    <input name={name} inputMode="decimal" required={required} autoComplete="off" className={field} />
    {hint ? <span className="text-xs font-normal text-muted">{hint}</span> : null}
  </label>
);

export function AddDealForm() {
  const [state, action, pending] = useActionState<DealFormState, FormData>(addDealAction, {});
  return (
    <form action={action} className="space-y-4 rounded-lg border border-line bg-surface p-5">
      <h3 className="text-sm font-semibold">Add a deal</h3>
      <p className="text-xs text-muted">All amounts are in JOD, without VAT. The quote figures are what the tender price sheet or quotation said before the deal was agreed.</p>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm font-medium">
          Kind
          <select name="kind" className={field}>
            <option value="tender">Tender contract</option>
            <option value="private">Private-sector sale</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          Reference
          <input name="ref" required maxLength={80} className={field} placeholder="Tender no., contract no. or sales order" />
        </label>
        <label className="text-sm font-medium">
          Customer
          <input name="customerName" required maxLength={200} className={field} />
        </label>
        <label className="text-sm font-medium md:col-span-2">
          What the deal is
          <input name="title" required maxLength={300} className={field} placeholder="Hematology analyser, ministry tender" />
        </label>
        <label className="text-sm font-medium">
          Customer reference on documents
          <input name="customerRef" maxLength={80} className={field} />
        </label>
        <Money name="contractPrice" label="Contract selling price" required />
      </div>
      <fieldset className="grid gap-3 md:grid-cols-4">
        <legend className="text-sm font-semibold">What the quote said</legend>
        <Money name="quoteDiscount" label="Customer discount" />
        <Money name="quoteAcquisition" label="Product cost" required />
        <Money name="quoteFreightCustoms" label="Freight and customs" />
        <Money name="quoteInstallation" label="Installation" />
        <Money name="quoteWarranty" label="Warranty set-aside" />
        <Money name="quoteCommission" label="Commission" />
        <Money name="quoteFinancing" label="Cost of waiting for payment" />
        <Money name="quoteOther" label="Other costs" />
        <Money name="quoteRebate" label="Rebate the quote counted on" hint="Shown, but never added to proven profit" />
      </fieldset>
      <fieldset className="grid gap-3 md:grid-cols-4">
        <legend className="text-sm font-semibold">What is still open</legend>
        <label className="text-sm font-medium">
          Delivered (%)
          <input name="deliveredPct" inputMode="decimal" className={field} />
        </label>
        <label className="text-sm font-medium">
          Installed (%)
          <input name="installedPct" inputMode="decimal" className={field} />
        </label>
        <Money name="receivableOutstanding" label="Unpaid invoices" />
        <label className="text-sm font-medium">
          Days the payment is late
          <input name="collectionDaysLate" inputMode="numeric" className={field} />
        </label>
        <label className="text-sm font-medium">
          Warranty months promised
          <input name="warrantyMonths" inputMode="numeric" className={field} />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="hasInstallation" /> Includes installation
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="warrantyOpen" /> Warranty still running
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="serviceOpen" /> Service duty still open
        </label>
      </fieldset>
      <fieldset className="grid gap-3 md:grid-cols-3">
        <legend className="text-sm font-semibold">How the ERP links to this deal (any that apply; separate several with commas)</legend>
        {(
          [
            ["contractNo", "Contract no."],
            ["tenderNo", "Tender no."],
            ["projectRefs", "Project / order refs"],
            ["invoiceNos", "Invoice nos."],
            ["serials", "Serial numbers"],
            ["poNos", "Purchase order nos."],
          ] as const
        ).map(([n, l]) => (
          <label key={n} className="text-sm font-medium">
            {l}
            <input name={n} className={field} />
          </label>
        ))}
        <label className="text-sm font-medium">
          Deal starts
          <input type="date" name="windowStart" className={field} />
        </label>
        <label className="text-sm font-medium">
          Deal ends
          <input type="date" name="windowEnd" className={field} />
        </label>
      </fieldset>
      <SubmitterField />
      <Status state={state} />
      <button type="submit" disabled={pending} className={submit}>
        {pending ? "Saving…" : "Add deal"}
      </button>
    </form>
  );
}

export function AddEntryForm({ dealId }: { dealId: string }) {
  const [state, action, pending] = useActionState<DealFormState, FormData>(addEntryAction, {});
  return (
    <form action={action} className="space-y-3 rounded-lg border border-line bg-surface p-5">
      <h3 className="text-sm font-semibold">Add a cost, discount or credit note</h3>
      <input type="hidden" name="dealId" value={dealId} />
      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-sm font-medium">
          Line
          <select name="line" className={field}>
            <option value="discount">Customer discount / credit note</option>
            {COST_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {COST_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <Money name="amount" label="Amount" hint="Minus sign = credit note" required />
        <label className="text-sm font-medium">
          Currency
          <input name="currency" defaultValue="JOD" maxLength={3} className={field} />
        </label>
        <Money name="fxRate" label="Rate (JOD per 1 unit)" hint="Only for a foreign currency" />
        <label className="text-sm font-medium">
          Is it
          <select name="status" className={field}>
            <option value="actual">Actual (booked)</option>
            <option value="estimated">Estimate</option>
            <option value="disputed">Disputed</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          Document type
          <input name="docType" maxLength={40} className={field} placeholder="supplier invoice" />
        </label>
        <label className="text-sm font-medium">
          Document number
          <input name="docNo" maxLength={80} className={field} />
        </label>
        <label className="text-sm font-medium">
          Date
          <input type="date" name="incurredOn" className={field} />
        </label>
        <label className="text-sm font-medium">
          Already included in
          <select name="coveredBy" className={field}>
            <option value="">Nowhere: count it</option>
            {COST_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {COST_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="vatIncluded" /> The amount includes VAT
        </label>
        <label className="text-sm font-medium">
          VAT rate (%)
          <input name="vatRate" defaultValue="16" className={field} />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="provision" /> Warranty set-aside
        </label>
        <label className="text-sm font-medium md:col-span-4">
          Note
          <input name="note" maxLength={500} className={field} />
        </label>
      </div>
      <SubmitterField />
      <Status state={state} />
      <button type="submit" disabled={pending} className={submit}>
        {pending ? "Saving…" : "Add to the cost record"}
      </button>
    </form>
  );
}

export function AddRebateForm({ dealId }: { dealId: string }) {
  const [state, action, pending] = useActionState<DealFormState, FormData>(addRebateAction, {});
  return (
    <form action={action} className="space-y-3 rounded-lg border border-line bg-surface p-5">
      <h3 className="text-sm font-semibold">Add a supplier rebate</h3>
      <input type="hidden" name="dealId" value={dealId} />
      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-sm font-medium">
          Supplier
          <input name="supplier" required className={field} />
        </label>
        <Money name="amount" label="Amount" required />
        <label className="text-sm font-medium">
          Currency
          <input name="currency" defaultValue="JOD" maxLength={3} className={field} />
        </label>
        <Money name="fxRate" label="Rate (JOD per 1 unit)" />
        <label className="text-sm font-medium">
          Status
          <select name="status" className={field}>
            {(Object.keys(REBATE_LABEL) as (keyof typeof REBATE_LABEL)[]).map((s) => (
              <option key={s} value={s}>
                {REBATE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Evidence (statement or agreement no.)
          <input name="evidenceRef" className={field} />
        </label>
        <label className="text-sm font-medium">
          Supplier credit note / receipt no.
          <input name="creditNoteRef" className={field} />
        </label>
      </div>
      <SubmitterField />
      <Status state={state} />
      <button type="submit" disabled={pending} className={submit}>
        {pending ? "Saving…" : "Add rebate"}
      </button>
    </form>
  );
}

/** Confirm / reject an uncertain match, or move it to another deal. */
export function ReviewEntryForm({ entryId, otherDeals }: { entryId: string; otherDeals: { id: string; ref: string }[] }) {
  const [state, action, pending] = useActionState<DealFormState, FormData>(reviewEntryAction, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="entryId" value={entryId} />
      <SubmitterField compact />
      <select name="moveTo" aria-label="Move to another deal" className="rounded-md border border-line bg-white px-2 py-1 text-xs">
        <option value="">Keep in this deal</option>
        {otherDeals.map((d) => (
          <option key={d.id} value={d.id}>
            Move to {d.ref}
          </option>
        ))}
      </select>
      <button name="decision" value="confirmed" disabled={pending} className={small}>
        Confirm
      </button>
      <button name="decision" value="rejected" disabled={pending} className="rounded-md border border-bad px-3 py-1.5 text-xs font-semibold text-bad disabled:opacity-60">
        Reject
      </button>
      {state.error ? (
        <span role="alert" className="text-xs text-bad">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

export function StartActionForm({ dealId, findingKey, title, today }: { dealId: string; findingKey: string; title: string; today: string }) {
  const [state, action, pending] = useActionState<DealFormState, FormData>(startActionAction, {});
  return (
    <form action={action} className="mt-2 flex flex-wrap items-end gap-2 border-t border-line pt-2">
      <input type="hidden" name="dealId" value={dealId} />
      <input type="hidden" name="findingKey" value={findingKey} />
      <input type="hidden" name="title" value={title} />
      <label className="text-xs font-medium">
        Due
        <input type="date" name="due" required defaultValue={today} className="ml-1 rounded-md border border-line bg-white px-2 py-1 text-xs" />
      </label>
      <SubmitterField compact />
      <button type="submit" disabled={pending} className={small}>
        Start a management action
      </button>
      <Status state={state} />
    </form>
  );
}

export function CheckOutcomesForm({ dealId }: { dealId: string }) {
  const [state, action, pending] = useActionState<DealFormState, FormData>(checkOutcomesAction, {});
  return (
    <form action={action} className="mt-2 flex flex-wrap items-center gap-3">
      <input type="hidden" name="dealId" value={dealId} />
      <button type="submit" disabled={pending} className={small}>
        Recalculate and check outcomes
      </button>
      <Status state={state} />
    </form>
  );
}

const POLICY_FIELDS = [
  ["minContributionMarginPct", "Minimum contribution margin (%)", "Deals below this are flagged"],
  ["maxDiscountPct", "Maximum customer discount (%)", "Discounts above this are flagged"],
  ["costOverrunTolerancePct", "Allowed cost overrun (%)", "A cost may go above its quote by this much. Empty = any excess counts"],
  ["deteriorationPp", "Allowed fall in margin (points)", "Quoted margin minus forecast margin"],
  ["financingRateAnnualPct", "Cost of waiting for payment (% a year)", "Used to price late payments"],
  ["roundingToleranceFils", "Rounding difference allowed (fils)", "1 fils = 0.001 JOD"],
] as const;

export function PolicyForm({ values }: { values: Record<(typeof POLICY_FIELDS)[number][0], string> }) {
  const [state, action, pending] = useActionState<DealFormState, FormData>(savePolicyAction, {});
  return (
    <form action={action} className="space-y-3 rounded-lg border border-line bg-surface p-5">
      <h3 className="text-sm font-semibold">Company limits</h3>
      <p className="text-xs text-muted">These are the company&rsquo;s own limits. The app never makes them up: a check that needs a limit stays silent until you enter it. Leave a field empty if the company has no such limit.</p>
      <div className="grid gap-3 md:grid-cols-3">
        {POLICY_FIELDS.map(([n, l, h]) => (
          <label key={n} className="text-sm font-medium">
            {l}
            <input name={n} defaultValue={values[n]} inputMode="decimal" className={field} />
            <span className="text-xs font-normal text-muted">{h}</span>
          </label>
        ))}
      </div>
      <SubmitterField />
      <Status state={state} />
      <button type="submit" disabled={pending} className={submit}>
        {pending ? "Saving…" : "Save limits"}
      </button>
    </form>
  );
}

/** Reads the chosen file in the browser (xlsx, xls or CSV in any common encoding) and sends only its CSV text to the server. */
export function ImportCostsForm() {
  const [state, action, pending] = useActionState<DealFormState, FormData>(importCostsAction, {});
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const file = (form.elements.namedItem("file") as HTMLInputElement).files?.[0];
    if (!file) return;
    const sheets = await readUploadedFile(file.name, file);
    const sheet = sheets.find((s) => !s.skipped && s.csv.trim() !== "") ?? sheets[0];
    const fd = new FormData(form);
    fd.delete("file");
    fd.set("csv", sheet?.csv ?? "");
    startTransition(() => action(fd));
  }
  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-line bg-surface p-5">
      <h3 className="text-sm font-semibold">Import costs from the ERP</h3>
      <p className="text-xs text-muted">
        Columns: {COST_FILE_COLUMNS.join(", ")}. Only “cost line” and “amount” are required, plus a transaction id or a document number, so that sending the same file twice changes nothing. Each row is linked to a deal by its contract, tender, project, invoice, serial or purchase-order number. If we are not sure, the row waits for your review. A row that fits no deal is listed but not saved. The column names are guesses until a real Alpha file is checked.
      </p>
      <input type="file" name="file" accept=".csv,.xlsx,.xls" required className="block text-sm" />
      <SubmitterField />
      <Status state={state} />
      <button type="submit" disabled={pending} className={submit}>
        {pending ? "Importing…" : "Import and match"}
      </button>
    </form>
  );
}
