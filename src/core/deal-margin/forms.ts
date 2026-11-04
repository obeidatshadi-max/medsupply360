/**
 * Cleaning of the forms for deals, ledger entries, rebates and the approved thresholds. Pure: the server action, the demo
 * and the tests all apply the same rules. Every field arrives as text; every refusal names the field and says what to type.
 */
import { isIsoDate } from "../calc";
import { COST_CATEGORIES, type CostCategory, type DealKind, type EntryStatus, type LedgerLine, type RebateStatus } from "./types";

type Ok<T> = { ok: true; value: T };
type Err = { ok: false; error: string };

const tidy = (v: unknown) => String(v ?? "").replace(/[\u0000-\u001f\u007f‎‏‪-‮]/g, " ").replace(/\s+/g, " ").trim();

/** A signed money amount with up to 3 decimals; commas are thousands separators. Blank = null. */
export function parseMoney(input: string, allowNegative = false): number | null | "invalid" {
  const t = tidy(input).replace(/,/g, "");
  if (t === "") return null;
  const re = allowNegative ? /^-?\d+(\.\d{1,3})?$/ : /^\d+(\.\d{1,3})?$/;
  return re.test(t) ? Number(t) : "invalid";
}

/** An exchange rate (JOD per 1 unit) with up to 6 decimals, above zero. Blank = null. */
export function parseRate(input: string): number | null | "invalid" {
  const t = tidy(input).replace(/,/g, "");
  if (t === "") return null;
  if (!/^\d+(\.\d{1,6})?$/.test(t)) return "invalid";
  const n = Number(t);
  return n > 0 ? n : "invalid";
}

/** A percentage 0-100 with up to 2 decimals. Blank = null. */
export function parsePct(input: string): number | null | "invalid" {
  const t = tidy(input).replace(/,/g, "");
  if (t === "") return null;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return "invalid";
  const n = Number(t);
  return n >= 0 && n <= 100 ? n : "invalid";
}

// ── Approved thresholds ───────────────────────────────────────────────────────────────────────────────────────────────
export interface PolicyForm {
  minContributionMarginPct: string;
  maxDiscountPct: string;
  costOverrunTolerancePct: string;
  deteriorationPp: string;
  financingRateAnnualPct: string;
  roundingToleranceFils: string;
}
export interface PolicyValues {
  minContributionMarginPct: number | null;
  maxDiscountPct: number | null;
  costOverrunTolerancePct: number | null;
  deteriorationPp: number | null;
  financingRateAnnualPct: number | null;
  roundingToleranceFils: number;
}

export function cleanPolicyForm(f: PolicyForm): Ok<PolicyValues> | Err {
  const keys = [
    ["minContributionMarginPct", "The minimum margin"],
    ["maxDiscountPct", "The maximum discount"],
    ["costOverrunTolerancePct", "The cost overrun tolerance"],
    ["deteriorationPp", "The allowed margin fall"],
    ["financingRateAnnualPct", "The yearly financing rate"],
  ] as const;
  const out: Record<string, number | null> = {};
  for (const [k, label] of keys) {
    const v = parsePct(f[k]);
    if (v === "invalid") return { ok: false, error: `${label} must be a percentage from 0 to 100, for example 15 or 7.5. Leave it empty if the company has not set one.` };
    out[k] = v;
  }
  const tol = tidy(f.roundingToleranceFils) === "" ? 1 : Number(tidy(f.roundingToleranceFils));
  if (!Number.isInteger(tol) || tol < 0 || tol > 100) return { ok: false, error: "The rounding tolerance is a whole number of fils from 0 to 100 (1 fils = 0.001 JOD)." };
  return { ok: true, value: { ...(out as Omit<PolicyValues, "roundingToleranceFils">), roundingToleranceFils: tol } };
}

// ── Ledger entry ──────────────────────────────────────────────────────────────────────────────────────────────────────
export interface EntryForm {
  line: string;
  amount: string;
  currency: string;
  fxRate: string;
  vatIncluded: string;
  vatRate: string;
  status: string;
  provision: string;
  docType: string;
  docNo: string;
  sourceKey: string;
  coveredBy: string;
  incurredOn: string;
  note: string;
}
export interface EntryValues {
  line: LedgerLine;
  amount: number;
  currency: string;
  fxRate: number | null;
  vatIncluded: boolean;
  vatRate: number;
  status: EntryStatus;
  provision: boolean;
  docType: string | null;
  docNo: string | null;
  sourceKey: string | null;
  coveredBy: CostCategory | null;
  incurredOn: string | null;
  note: string | null;
}

export const LINES: readonly LedgerLine[] = ["discount", ...COST_CATEGORIES];
const CURRENCY = /^[A-Z]{3}$/;

export function cleanEntryForm(f: EntryForm): Ok<EntryValues> | Err {
  const line = tidy(f.line) as LedgerLine;
  if (!LINES.includes(line)) return { ok: false, error: "Choose which line of the waterfall this amount belongs to." };
  const amount = parseMoney(f.amount, true);
  if (amount === null || amount === "invalid") return { ok: false, error: "Type the amount without VAT unless you tick “includes VAT”, for example 2,500.000. Use a minus sign for a credit note." };
  const currency = tidy(f.currency).toUpperCase() || "JOD";
  if (!CURRENCY.test(currency)) return { ok: false, error: "The currency is a three-letter code such as JOD, USD or EUR." };
  const rate = parseRate(f.fxRate);
  if (rate === "invalid") return { ok: false, error: "The exchange rate is JOD per 1 unit of the currency, for example 0.709 for USD." };
  if (currency !== "JOD" && (rate === null || rate <= 0)) return { ok: false, error: `Type the exchange rate (JOD per 1 ${currency}). Without it the amount cannot be converted and would be held out of the margin.` };
  const vatIncluded = tidy(f.vatIncluded) === "on" || tidy(f.vatIncluded) === "true";
  const vr = parsePct(f.vatRate);
  if (vr === "invalid") return { ok: false, error: "The VAT rate is a percentage, for example 16." };
  const status = (tidy(f.status) || "actual") as EntryStatus;
  if (!["actual", "estimated", "disputed"].includes(status)) return { ok: false, error: "Choose whether the amount is actual, estimated or disputed." };
  const provision = tidy(f.provision) === "on" || tidy(f.provision) === "true";
  if (provision && line !== "warranty") return { ok: false, error: "Only a warranty amount can be a provision." };
  const coveredByRaw = tidy(f.coveredBy);
  const coveredBy = coveredByRaw === "" ? null : (coveredByRaw as CostCategory);
  if (coveredBy !== null && !COST_CATEGORIES.includes(coveredBy)) return { ok: false, error: "“Already included in” must be one of the cost lines." };
  if (coveredBy !== null && coveredBy === line) return { ok: false, error: "A cost cannot be included in its own line." };
  const incurredOn = tidy(f.incurredOn);
  if (incurredOn !== "" && !isIsoDate(incurredOn)) return { ok: false, error: "Choose the date of the cost, or leave it empty." };
  const docNo = tidy(f.docNo).slice(0, 80) || null;
  const docType = tidy(f.docType).slice(0, 40) || null;
  const sourceKey = tidy(f.sourceKey).slice(0, 160) || (docNo ? `manual:${docType ?? "doc"}:${docNo}:${line}` : null);
  return {
    ok: true,
    value: {
      line,
      amount,
      currency,
      fxRate: currency === "JOD" ? null : rate,
      vatIncluded,
      vatRate: vr === null ? 0.16 : vr / 100,
      status,
      provision,
      docType,
      docNo,
      sourceKey,
      coveredBy,
      incurredOn: incurredOn === "" ? null : incurredOn,
      note: tidy(f.note).slice(0, 500) || null,
    },
  };
}

// ── Rebate ────────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface RebateForm {
  supplier: string;
  amount: string;
  currency: string;
  fxRate: string;
  status: string;
  evidenceRef: string;
  creditNoteRef: string;
}
export interface RebateValues {
  supplier: string;
  amount: number;
  currency: string;
  fxRate: number | null;
  status: RebateStatus;
  evidenceRef: string | null;
  creditNoteRef: string | null;
}

export function cleanRebateForm(f: RebateForm): Ok<RebateValues> | Err {
  const supplier = tidy(f.supplier);
  if (supplier.length < 2) return { ok: false, error: "Type the supplier's name." };
  const amount = parseMoney(f.amount);
  if (amount === null || amount === "invalid" || amount <= 0) return { ok: false, error: "Type the rebate amount above zero, for example 2,000.000." };
  const currency = tidy(f.currency).toUpperCase() || "JOD";
  if (!CURRENCY.test(currency)) return { ok: false, error: "The currency is a three-letter code such as JOD or USD." };
  const rate = parseRate(f.fxRate);
  if (rate === "invalid") return { ok: false, error: "The exchange rate is JOD per 1 unit of the currency." };
  if (currency !== "JOD" && (rate === null || rate <= 0)) return { ok: false, error: `Type the exchange rate (JOD per 1 ${currency}).` };
  const status = tidy(f.status) as RebateStatus;
  if (!["contractual", "earned", "accrued", "received"].includes(status)) return { ok: false, error: "Choose the rebate's status: contractual, earned, accrued or received." };
  const evidenceRef = tidy(f.evidenceRef).slice(0, 120) || null;
  const creditNoteRef = tidy(f.creditNoteRef).slice(0, 120) || null;
  if (status !== "contractual" && !evidenceRef) return { ok: false, error: "An earned, accrued or received rebate needs its evidence: the supplier's rebate statement or agreement number." };
  return { ok: true, value: { supplier: supplier.slice(0, 200), amount, currency, fxRate: currency === "JOD" ? null : rate, status, evidenceRef, creditNoteRef } };
}

// ── Deal ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface DealForm {
  kind: string;
  ref: string;
  title: string;
  customerName: string;
  customerRef: string;
  contractPrice: string;
  quoteDiscount: string;
  quoteAcquisition: string;
  quoteFreightCustoms: string;
  quoteInstallation: string;
  quoteWarranty: string;
  quoteCommission: string;
  quoteFinancing: string;
  quoteOther: string;
  quoteRebate: string;
  warrantyMonths: string;
  hasInstallation: string;
  deliveredPct: string;
  installedPct: string;
  receivableOutstanding: string;
  collectionDaysLate: string;
  warrantyOpen: string;
  serviceOpen: string;
  contractNo: string;
  tenderNo: string;
  projectRefs: string;
  invoiceNos: string;
  serials: string;
  poNos: string;
  windowStart: string;
  windowEnd: string;
}

export interface DealValues {
  kind: DealKind;
  ref: string;
  title: string;
  customerName: string;
  customerRef: string | null;
  contractPrice: number;
  quote: { price: number; discount: number; costs: Record<CostCategory, number>; assumedRebate: number };
  obligations: { deliveredPct: number | null; installedPct: number | null; receivableOutstanding: number; warrantyOpen: boolean; serviceOpen: boolean };
  warrantyMonths: number;
  hasInstallation: boolean;
  collectionDaysLate: number;
  identifiers: { contractNo: string | null; tenderNo: string | null; projectRefs: string[]; invoiceNos: string[]; serials: string[]; poNos: string[] };
  windowStart: string | null;
  windowEnd: string | null;
}

const list = (v: string) => [...new Set(tidy(v).split(/[;,]/).map((x) => x.trim()).filter(Boolean))].slice(0, 50);
const flag = (v: string) => ["on", "true"].includes(tidy(v));

export function cleanDealForm(f: DealForm): Ok<DealValues> | Err {
  const kind = tidy(f.kind) as DealKind;
  if (kind !== "tender" && kind !== "private") return { ok: false, error: "Choose tender or private sale." };
  const ref = tidy(f.ref).slice(0, 80);
  if (ref.length < 2) return { ok: false, error: "Type the deal reference (tender number, contract number or sales order)." };
  const title = tidy(f.title);
  if (title.length < 3 || !/\p{L}/u.test(title)) return { ok: false, error: "Type what the deal is, for example “Hematology analyser, ministry tender”." };
  const customerName = tidy(f.customerName);
  if (customerName.length < 2) return { ok: false, error: "Type the customer's name." };
  const price = parseMoney(f.contractPrice);
  if (price === null || price === "invalid" || price <= 0) return { ok: false, error: "Type the contract selling price without VAT, above zero, for example 100,000.000." };
  const money = (v: string, label: string): number | Err => {
    const m = parseMoney(v);
    return m === "invalid" ? { ok: false, error: `${label} must be an amount in JOD without VAT, for example 2,500.000. Leave it empty if the quote had none.` } : (m ?? 0);
  };
  const fields: [keyof DealForm, string][] = [
    ["quoteDiscount", "The quoted discount"],
    ["quoteAcquisition", "The quoted product cost"],
    ["quoteFreightCustoms", "The quoted freight and customs"],
    ["quoteInstallation", "The quoted installation cost"],
    ["quoteWarranty", "The quoted warranty provision"],
    ["quoteCommission", "The quoted commission"],
    ["quoteFinancing", "The quoted financing cost"],
    ["quoteOther", "The quoted other costs"],
    ["quoteRebate", "The rebate counted in the quote"],
  ];
  const vals: Record<string, number> = {};
  for (const [k, label] of fields) {
    const m = money(f[k], label);
    if (typeof m !== "number") return m;
    vals[k] = m;
  }
  if (vals.quoteAcquisition <= 0) return { ok: false, error: "Type the quoted product cost: a margin cannot be worked out without it." };
  const months = tidy(f.warrantyMonths) === "" ? 0 : Number(tidy(f.warrantyMonths));
  if (!Number.isInteger(months) || months < 0 || months > 240) return { ok: false, error: "Warranty months is a whole number from 0 to 240." };
  const pctOrNull = (v: string, label: string): number | null | Err => {
    const p = parsePct(v);
    return p === "invalid" ? { ok: false, error: `${label} is a percentage from 0 to 100, or empty when not known.` } : p;
  };
  const delivered = pctOrNull(f.deliveredPct, "Delivered");
  if (typeof delivered === "object" && delivered !== null) return delivered;
  const installed = pctOrNull(f.installedPct, "Installed");
  if (typeof installed === "object" && installed !== null) return installed;
  const recv = parseMoney(f.receivableOutstanding);
  if (recv === "invalid") return { ok: false, error: "Unpaid invoice value must be an amount in JOD, or empty." };
  const late = tidy(f.collectionDaysLate) === "" ? 0 : Number(tidy(f.collectionDaysLate));
  if (!Number.isInteger(late) || late < 0 || late > 3650) return { ok: false, error: "Days late is a whole number, 0 or more." };
  for (const [v, label] of [[f.windowStart, "The deal start date"], [f.windowEnd, "The deal end date"]] as const) {
    if (tidy(v) !== "" && !isIsoDate(tidy(v))) return { ok: false, error: `${label} must be a date, or empty.` };
  }
  if (tidy(f.windowStart) && tidy(f.windowEnd) && tidy(f.windowStart) > tidy(f.windowEnd)) return { ok: false, error: "The deal cannot end before it starts." };
  const hasInstallation = flag(f.hasInstallation);
  return {
    ok: true,
    value: {
      kind,
      ref,
      title: title.slice(0, 300),
      customerName: customerName.slice(0, 200),
      customerRef: tidy(f.customerRef).slice(0, 80) || null,
      contractPrice: price,
      quote: {
        price,
        discount: vals.quoteDiscount,
        costs: { acquisition: vals.quoteAcquisition, freight_customs: vals.quoteFreightCustoms, installation: vals.quoteInstallation, warranty: vals.quoteWarranty, commission: vals.quoteCommission, financing: vals.quoteFinancing, other: vals.quoteOther },
        assumedRebate: vals.quoteRebate,
      },
      obligations: { deliveredPct: delivered, installedPct: hasInstallation ? installed : null, receivableOutstanding: recv ?? 0, warrantyOpen: flag(f.warrantyOpen), serviceOpen: flag(f.serviceOpen) },
      warrantyMonths: months,
      hasInstallation,
      collectionDaysLate: late,
      identifiers: { contractNo: tidy(f.contractNo).slice(0, 80) || null, tenderNo: tidy(f.tenderNo).slice(0, 80) || null, projectRefs: list(f.projectRefs), invoiceNos: list(f.invoiceNos), serials: list(f.serials), poNos: list(f.poNos) },
      windowStart: tidy(f.windowStart) || null,
      windowEnd: tidy(f.windowEnd) || null,
    },
  };
}
