/**
 * Reads a deal-cost file (CSV text; the browser turns .xlsx and .xls into CSV text first, through the importer's shared
 * file reader) into ERP transactions, then matches each one to a deal.
 *
 * THE HEADING NAMES ARE ASSUMPTIONS, like the rest of the Alpha importer: no real Alpha export has been seen yet. Matching
 * ignores case, spaces and punctuation, and the company can send the file with the plain names listed in the template.
 * A row that cannot be read is rejected with its line number; a row that reads but cannot be tied to a deal is listed as
 * unmatched and written nowhere.
 */
import { detectDelimiter, parseCsv } from "../import/csv";
import { isIsoDate } from "../calc";
import { COST_CATEGORIES, type LedgerEntry, type LedgerLine } from "./types";
import { matchTransaction, toLedgerEntry, type DealIdentifiers, type ErpTransaction, type MatchResult } from "./match";
import { parseMoney, parseRate } from "./forms";

const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

const FIELDS: Record<string, string[]> = {
  sourceKey: ["sourcekey", "transactionid", "transactionkey", "id", "رقمالحركة"],
  docType: ["doctype", "documenttype", "type", "نوعالمستند"],
  docNo: ["docno", "documentno", "documentnumber", "voucherno", "رقمالمستند", "رقمالسند"],
  lineNo: ["lineno", "line", "linenumber", "رقمالسطر"],
  costLine: ["costline", "costtype", "category", "costcategory", "account", "نوعالتكلفة", "البند"],
  amount: ["amount", "value", "amountexclvat", "netamount", "المبلغ", "القيمة"],
  currency: ["currency", "curr", "العملة"],
  fxRate: ["fxrate", "exchangerate", "rate", "سعرالصرف"],
  vatIncluded: ["vatincluded", "includesvat", "taxincluded", "شاملضريبة"],
  vatRate: ["vatrate", "taxrate", "نسبةالضريبة"],
  date: ["date", "docdate", "transactiondate", "postingdate", "التاريخ"],
  contractNo: ["contractno", "contractnumber", "contract", "رقمالعقد"],
  tenderNo: ["tenderno", "tendernumber", "tender", "رقمالعطاء"],
  projectRef: ["projectref", "projectno", "project", "orderno", "salesorder", "رقمالمشروع"],
  invoiceNo: ["invoiceno", "invoicenumber", "invoice", "رقمالفاتورة"],
  serial: ["serial", "serialno", "serialnumber", "الرقمالتسلسلي"],
  poNo: ["pono", "purchaseorder", "purchaseorderno", "po", "رقمأمرالشراء"],
  customerRef: ["customerref", "customercode", "customerid", "رمزالعميل"],
  customerName: ["customername", "customer", "اسمالعميل", "العميل"],
  status: ["status", "entrystatus", "الحالة"],
};

/** What people call each waterfall line, mapped to the line. Anything else is rejected, never guessed. */
const LINE_WORDS: Record<LedgerLine, string[]> = {
  discount: ["discount", "customerdiscount", "creditnote", "خصم"],
  acquisition: ["acquisition", "productcost", "purchase", "cogs", "cost", "تكلفةالمنتج", "شراء"],
  freight_customs: ["freight", "customs", "freightcustoms", "freightandcustoms", "shipping", "شحن", "جمارك"],
  installation: ["installation", "commissioning", "installationcommissioning", "تركيب"],
  warranty: ["warranty", "warrantyprovision", "كفالة", "ضمان"],
  commission: ["commission", "salescommission", "عمولة"],
  financing: ["financing", "financecost", "collectioncost", "interest", "تمويل"],
  other: ["other", "otherfulfilment", "otherfulfillment", "misc", "أخرى"],
};

export interface CostRowError {
  row: number;
  reason: string;
}

export interface ParsedCosts {
  transactions: ErpTransaction[];
  /** Entry status for each transaction (actual unless the file says otherwise), by source key. */
  statuses: Map<string, LedgerEntry["status"]>;
  errors: CostRowError[];
  rows: number;
}

export const MAX_ROWS = 20000;

function lineFromWord(word: string): LedgerLine | null {
  const w = norm(word);
  for (const l of ["discount", ...COST_CATEGORIES] as LedgerLine[]) if (LINE_WORDS[l].some((x) => norm(x) === w)) return l;
  return null;
}

export function parseCostFile(csv: string, systemName = "ERP"): ParsedCosts {
  const out: ParsedCosts = { transactions: [], statuses: new Map(), errors: [], rows: 0 };
  let records: string[][];
  try {
    records = parseCsv(csv, detectDelimiter(csv)).records;
  } catch (e) {
    out.errors.push({ row: 1, reason: e instanceof Error ? e.message : "The file could not be read." });
    return out;
  }
  const header = records[0] ?? [];
  const col: Record<string, number> = {};
  header.forEach((h, i) => {
    const n = norm(h);
    for (const [key, aliases] of Object.entries(FIELDS)) if (col[key] === undefined && (n === norm(key) || aliases.some((a) => norm(a) === n))) col[key] = i;
  });
  for (const need of ["costLine", "amount"]) if (col[need] === undefined) out.errors.push({ row: 1, reason: `The file has no “${need === "costLine" ? "cost line" : "amount"}” column.` });
  if (out.errors.length > 0) return out;
  const get = (r: string[], k: string) => (col[k] === undefined ? "" : (r[col[k]] ?? "").trim());
  const body = records.slice(1);
  if (body.length > MAX_ROWS) {
    out.errors.push({ row: 1, reason: `The file has ${body.length} rows; send at most ${MAX_ROWS} at a time.` });
    return out;
  }
  const seen = new Set<string>();
  body.forEach((r, idx) => {
    const row = idx + 2;
    if (r.every((c) => c.trim() === "")) return;
    out.rows += 1;
    const line = lineFromWord(get(r, "costLine"));
    if (line === null) return void out.errors.push({ row, reason: `“${get(r, "costLine")}” is not a known cost line. Use: discount, product cost, freight/customs, installation, warranty, commission, financing, other.` });
    const amount = parseMoney(get(r, "amount"), true);
    if (amount === null || amount === "invalid") return void out.errors.push({ row, reason: "The amount is missing or not a number (up to 3 decimals; a minus sign marks a credit note)." });
    const currency = (get(r, "currency") || "JOD").toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) return void out.errors.push({ row, reason: "The currency must be a three-letter code such as JOD or USD." });
    const rate = parseRate(get(r, "fxRate"));
    if (rate === "invalid") return void out.errors.push({ row, reason: "The exchange rate is not a number." });
    const date = get(r, "date");
    if (date !== "" && !isIsoDate(date)) return void out.errors.push({ row, reason: "The date must be written YYYY-MM-DD." });
    const docNo = get(r, "docNo");
    const docType = get(r, "docType") || "document";
    const lineNo = get(r, "lineNo") || null;
    const key = get(r, "sourceKey") || (docNo ? `${systemName}:${docType}:${docNo}:${lineNo ?? ""}:${line}` : "");
    if (key === "") return void out.errors.push({ row, reason: "The row has neither a transaction id nor a document number, so it cannot be recognised on a second import." });
    if (seen.has(key)) return void out.errors.push({ row, reason: `The same transaction (${key}) appears twice in this file; it is counted once.` });
    seen.add(key);
    const vatText = norm(get(r, "vatIncluded"));
    const vatRatePct = get(r, "vatRate") === "" ? 16 : Number(get(r, "vatRate").replace(/%/, ""));
    if (!Number.isFinite(vatRatePct) || vatRatePct < 0 || vatRatePct > 100) return void out.errors.push({ row, reason: "The VAT rate must be a percentage such as 16." });
    const statusWord = norm(get(r, "status"));
    out.statuses.set(key, statusWord === "estimated" || statusWord === "estimate" ? "estimated" : statusWord === "disputed" ? "disputed" : "actual");
    const nz = (v: string) => (v === "" ? null : v);
    out.transactions.push({
      sourceKey: key,
      system: systemName,
      docType,
      docNo,
      lineNo,
      line,
      amount,
      currency,
      fxRate: currency === "JOD" ? null : rate,
      vatIncluded: ["yes", "y", "true", "1", "نعم"].includes(vatText),
      vatRate: vatRatePct / 100,
      date: date === "" ? null : date,
      contractNo: nz(get(r, "contractNo")),
      tenderNo: nz(get(r, "tenderNo")),
      projectRef: nz(get(r, "projectRef")),
      invoiceNo: nz(get(r, "invoiceNo")),
      serial: nz(get(r, "serial")),
      poNo: nz(get(r, "poNo")),
      customerRef: nz(get(r, "customerRef")),
      customerName: nz(get(r, "customerName")),
    });
  });
  return out;
}

export interface MatchedCosts {
  entries: LedgerEntry[];
  /** Transactions tied to no deal: listed, never written. */
  unmatched: { txn: ErpTransaction; match: MatchResult }[];
  /** Matched with less than exact confidence: written as pending, so they wait for a person. */
  needReview: number;
  exact: number;
}

export function matchCosts(parsed: ParsedCosts, deals: readonly DealIdentifiers[]): MatchedCosts {
  const entries: LedgerEntry[] = [];
  const unmatched: MatchedCosts["unmatched"] = [];
  let needReview = 0;
  let exact = 0;
  for (const txn of parsed.transactions) {
    const m = matchTransaction(txn, deals);
    const e = toLedgerEntry(txn, m, parsed.statuses.get(txn.sourceKey) === "estimated");
    if (!e) {
      unmatched.push({ txn, match: m });
      continue;
    }
    const status = parsed.statuses.get(txn.sourceKey) ?? "actual";
    entries.push({ ...e, status });
    if (m.confidence === "exact") exact++;
    else needReview++;
  }
  return { entries, unmatched, needReview, exact };
}

/** The columns a company sends. Shown on the page and used as the downloadable template. */
export const COST_FILE_COLUMNS = ["transaction id", "document type", "document no", "line no", "cost line", "amount", "currency", "fx rate", "vat included", "vat rate", "date", "contract no", "tender no", "project ref", "invoice no", "serial", "po no", "customer ref", "customer name", "status"] as const;
