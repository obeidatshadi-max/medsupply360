import { AUTHORITIES, CLOSE_REASONS, LINE_LABEL, PRODUCT_LINES, closeReasonsFor, type TenderStatus } from "@/core/tender-flow";
import type { TenderRow } from "@/server/services/tenders";

export const fieldClass = "mt-1 block w-full rounded-md border border-line bg-white px-3 py-2 text-sm";

/** What a form posts for each tender field, as the text a person would type. */
export type FieldValues = Record<
  "authority" | "tenderNo" | "title" | "productLine" | "estimatedValue" | "deadline" | "bidValue" | "awardAmount" | "closeReason" | "closeReasonCode" | "winnerName" | "winningPrice" | "expectedAwardDate" | "submittedOn" | "bidOpeningDate" | "contractNo" | "contractValue" | "deliveredOn" | "notes",
  string
>;

const amount = (v: number | null) => (v === null ? "" : String(v));

export function valuesOf(t: TenderRow | null): FieldValues {
  return {
    authority: t?.authority ?? "MOH",
    tenderNo: t?.tenderNo ?? "",
    title: t?.title ?? "",
    productLine: t?.productLine ?? "equipment",
    estimatedValue: amount(t?.estimatedValue ?? null),
    deadline: t?.deadline ?? "",
    bidValue: amount(t?.bidValue ?? null),
    awardAmount: amount(t?.awardAmount ?? null),
    closeReason: t?.closeReason ?? "",
    closeReasonCode: t?.closeReasonCode ?? "",
    winnerName: t?.winnerName ?? "",
    winningPrice: amount(t?.winningPrice ?? null),
    expectedAwardDate: t?.expectedAwardDate ?? "",
    submittedOn: t?.submittedOn ?? "",
    bidOpeningDate: t?.bidOpeningDate ?? "",
    contractNo: t?.contractNo ?? "",
    contractValue: amount(t?.contractValue ?? null),
    deliveredOn: t?.deliveredOn ?? "",
    notes: t?.notes ?? "",
  };
}

type Key = keyof FieldValues;

export const LABEL: Record<Key, string> = {
  authority: "Authority",
  tenderNo: "Tender number",
  title: "Short title",
  productLine: "Products",
  estimatedValue: "Estimated value (JOD)",
  deadline: "Submission deadline",
  bidValue: "Our bid value (JOD)",
  awardAmount: "Award amount (JOD)",
  closeReason: "Note on the reason (lost or cancelled)",
  closeReasonCode: "Reason (lost or cancelled)",
  winnerName: "Winning company (if known)",
  winningPrice: "Winning price (JOD, if known)",
  expectedAwardDate: "Expected award date (if known)",
  submittedOn: "Date the bid was handed in",
  bidOpeningDate: "Bid opening date (if announced)",
  contractNo: "Contract or PO number",
  contractValue: "Contract value (JOD)",
  deliveredOn: "Delivery date",
  notes: "Notes",
};

const DATE_KEYS: Key[] = ["deadline", "bidOpeningDate", "submittedOn", "expectedAwardDate", "deliveredOn"];
const MONEY_KEYS: Key[] = ["estimatedValue", "bidValue", "awardAmount", "winningPrice", "contractValue"];

/** One labelled input for a tender field. */
/** `endingAs` limits the reason list to the reasons that fit a tender ending as Lost or Cancelled. */
export function FieldInput({ name, value, required = false, endingAs }: { name: Key; value: string; required?: boolean; endingAs?: TenderStatus }) {
  const id = `f-${name}`;
  const label = LABEL[name];
  let control: React.ReactNode;
  if (name === "authority") {
    control = (
      <select id={id} name={name} defaultValue={value} required className={fieldClass}>
        {AUTHORITIES.map((a) => (
          <option key={a.code} value={a.code}>
            {a.code} · {a.name}
          </option>
        ))}
      </select>
    );
  } else if (name === "productLine") {
    control = (
      <select id={id} name={name} defaultValue={value} required className={fieldClass}>
        {PRODUCT_LINES.map((l) => (
          <option key={l} value={l}>
            {LINE_LABEL[l]}
          </option>
        ))}
      </select>
    );
  } else if (name === "closeReasonCode") {
    const reasons = endingAs ? closeReasonsFor(endingAs) : CLOSE_REASONS;
    control = (
      <select id={id} name={name} defaultValue={value} required={required} className={fieldClass}>
        <option value="">{required ? "Choose a reason" : "Not recorded"}</option>
        {reasons.map((r) => (
          <option key={r.code} value={r.code}>
            {r.label}
          </option>
        ))}
      </select>
    );
  } else if (name === "notes" || name === "closeReason") {
    control = <textarea id={id} name={name} defaultValue={value} rows={3} maxLength={name === "notes" ? 4000 : 2000} required={required} className={fieldClass} />;
  } else if (DATE_KEYS.includes(name)) {
    control = <input id={id} name={name} type="date" defaultValue={value} required={required} className={fieldClass} />;
  } else {
    control = (
      <input
        id={id}
        name={name}
        type="text"
        inputMode={MONEY_KEYS.includes(name) ? "decimal" : undefined}
        defaultValue={value}
        required={required || name === "title"}
        maxLength={name === "title" ? 300 : name === "winnerName" ? 200 : 80}
        autoComplete="off"
        className={fieldClass}
      />
    );
  }
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {control}
    </div>
  );
}

/** Carries a field's current value in a form that does not show it, so saving never blanks it. */
export function HiddenField({ name, value }: { name: Key; value: string }) {
  return <input type="hidden" name={name} value={value} />;
}
