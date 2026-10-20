/**
 * What each ERP export must contain (workbook sheet "ERP requirements", E01-E07 plus installed units).
 *
 * THE HEADER NAMES BELOW ARE ASSUMPTIONS. The workbook states required business fields, not Alpha's real column
 * names. When the Alpha sample arrives, adjust the `aliases` here; nothing else in the importer depends on them.
 * Day-first dates (D/M/YYYY) and the document / transaction wording are likewise to be confirmed against the sample.
 */
import { missingFor, type TenderFields, type TenderStatus } from "../tender-flow";
import { EMAIL_MAX, NAME_MAX, NEW_ACCOUNTS_MAX, SUPPLIERS_MAX, SUPPLIER_NAME_MAX, VISITS_MAX } from "../sales-force";
import { bool, code, date, days, money, nonNegativeMoney, oneOf, positiveDecimal, quantity, semicolonList, text, wholeNumber, type Parser, type Value } from "./parsers";

export type ImportKind =
  | "products"
  | "customers"
  | "sales"
  | "receipts"
  | "open_invoices"
  | "stock_snapshot"
  | "stock_transactions"
  | "installed_units"
  | "tenders"
  | "sales_people";

export type Values = Record<string, Value>;

export interface FieldSpec {
  key: string;
  /** Accepted header spellings. Matching ignores case, spaces and punctuation; the key itself always matches. */
  aliases: string[];
  required: boolean;
  parse: Parser;
  /** Used when the cell, or the whole column, is empty. Without one, an empty optional field is NULL (unknown). */
  fallback?: Value;
}

export interface RowRef {
  row: number;
  values: Values;
}

export interface FileSpec {
  kind: ImportKind;
  title: string;
  fields: FieldSpec[];
  /** Identity of a row inside the file. A second row with the same key is rejected, not merged silently. */
  key: (v: Values) => string;
  /** Point-in-time file: all rows share one snapshot date, from a column or from the upload form. */
  snapshot?: boolean;
  /** Date fields that cannot be after the import day. A future order means a bad file or a day/month mix-up. */
  notFuture?: string[];
  /** Fills a value that can be worked out from the others. Runs before `check`. */
  derive?: (v: Values) => void;
  /** Rule inside one row. Returns the reason to reject it. */
  check?: (v: Values) => string | null;
  /** Rule across rows. Returns a reason per rejected row number. */
  checkGroups?: (rows: RowRef[]) => Map<number, string>;
}

const f = (key: string, aliases: string[], required: boolean, parse: Parser, fallback?: Value): FieldSpec => ({
  key,
  aliases,
  required,
  parse,
  fallback,
});

const fils = (v: Value) => Math.round(Number(v) * 1000);
const k = (...parts: Value[]) => parts.map(String).join("\u0000");

const customerCode = f("customerCode", ["customer code", "customer id", "customer no", "customer", "cust code", "رقم العميل"], true, code(80));
const productCode = (required: boolean) =>
  f("productCode", ["product code", "item code", "item", "product", "sku", "item no", "رقم الصنف"], required, code(80));
const accountOwner = f("accountOwner", ["account owner", "sales rep", "salesperson", "owner", "مسؤول الحساب"], false, text(200));
const snapshotDate = f("snapshotDate", ["snapshot date", "as of", "as of date", "report date", "تاريخ الكشف"], false, date);

const productLine = oneOf(
  "product category",
  {
    Equipment: ["equipments", "capital equipment", "أجهزة"],
    Devices: ["device", "medical devices", "medical device"],
    Consumables: ["consumable", "مستهلكات"],
  },
  "reject",
);

const segment = oneOf(
  "customer segment",
  {
    Tender: ["public", "public sector", "government", "gov", "tenders", "عطاء", "حكومي"],
    Private: ["private sector", "خاص"],
  },
  "null",
);

const docType = oneOf(
  "document type",
  { invoice: ["sale", "sales", "sales invoice", "فاتورة"], return: ["credit", "credit note", "sales return", "returns", "مرتجع"] },
  "reject",
);

const stockTxType = oneOf(
  "transaction type",
  {
    customer_issue: ["issue", "sales issue", "delivery", "sale", "صرف"],
    customer_return: ["return", "sales return", "customer returns", "مرتجع"],
    transfer: ["transfers", "warehouse transfer", "تحويل"],
    purchase_receipt: ["purchase", "receipt", "goods receipt", "grn", "purchase receipts", "استلام"],
    adjustment: ["adjustments", "stock adjustment", "count adjustment", "تسوية"],
  },
  "reject",
);

const serviceStatus = oneOf(
  "service status",
  { Active: ["active", "in contract", "ساري"], Expiring: ["expiring", "renewal due"], "No contract": ["none", "no agreement", "expired", "بدون عقد"] },
  "null",
);

/** Own stock is valued; consignment / third-party stock is kept but excluded from values. */
const ownership: Parser = (raw) => {
  const s = raw.trim().toLowerCase();
  if (["own", "owned", "yes", "y", "true", "1", "نعم"].includes(s)) return { ok: true, value: true };
  if (["consignment", "third party", "third-party", "not owned", "no", "n", "false", "0", "لا"].includes(s)) return { ok: true, value: false };
  const asBool = bool(raw);
  return asBool.ok ? asBool : { ok: false, reason: `expected owned / consignment, got "${raw}"` };
};

const tenderAuthority = oneOf(
  "authority",
  {
    MOH: ["ministry of health", "وزارة الصحة"],
    KHCC: ["king hussein cancer center", "king hussein cancer centre", "مركز الحسين للسرطان"],
    DRMS: ["royal medical services", "rms", "الخدمات الطبية الملكية"],
    JUH: ["jordan university hospital", "مستشفى الجامعة الأردنية"],
    KAUH: ["king abdullah university hospital", "kauh hospital", "مستشفى الملك عبدالله المؤسس"],
  },
  "reject",
);

const tenderLine = oneOf(
  "tender product line",
  {
    equipment: ["equipments", "devices", "device", "أجهزة"],
    consumables: ["consumable", "reagents", "مستهلكات"],
    mixed: ["equipment and consumables", "equipment & consumables", "both", "مختلط"],
  },
  "reject",
);

const tenderStatus = oneOf(
  "tender status",
  {
    pipeline: ["opportunity", "identified", "expected"],
    open: ["announced", "tender announced"],
    preparing: ["bid preparation", "in preparation", "preparation"],
    submitted: ["bid submitted"],
    technical_review: ["technical evaluation", "technical"],
    financial_review: ["financial evaluation", "financial"],
    won: ["awarded", "award won"],
    lost: ["not awarded"],
    cancelled: ["canceled", "dropped"],
    contracted: ["contract", "contract signed", "po", "purchase order"],
    delivered: ["supplied"],
    collected: ["paid", "payment collected"],
  },
  "reject",
);

const asNumber = (v: Value | undefined) => (v == null ? null : Number(v));
const asText = (v: Value | undefined) => (v == null ? null : String(v));

export const SPECS: Record<ImportKind, FileSpec> = {
  products: {
    kind: "products",
    title: "Product and supplier list (E01)",
    key: (v) => k(v.code),
    fields: [
      f("code", ["product code", "item code", "code", "sku", "item no", "product id", "رقم الصنف"], true, code(80)),
      f("name", ["product name", "item name", "name", "description", "اسم الصنف"], true, text(300)),
      f("line", ["category", "product line", "line", "product category", "type", "الفئة"], true, productLine),
      f("therapeuticArea", ["therapeutic area", "clinical area", "therapy area", "specialty", "speciality", "المجال العلاجي"], false, text(100)),
      f("manufacturer", ["manufacturer", "maker", "brand"], false, text(200)),
      f("supplierCode", ["supplier code", "supplier id", "vendor code"], false, code(80)),
      f("supplierName", ["supplier name", "supplier", "vendor", "vendor name"], false, text(200)),
      f("unit", ["unit", "counting unit", "uom", "unit of measure"], false, text(30)),
      f("packConversion", ["pack conversion", "pack size", "units per pack", "conversion"], false, positiveDecimal),
      f("tracksExpiry", ["expiry tracked", "tracks expiry", "expiry tracking", "has expiry"], false, bool, false),
      f("active", ["active", "is active", "status"], false, bool, true),
    ],
  },

  customers: {
    kind: "customers",
    title: "Customer list (E02)",
    key: (v) => k(v.code),
    fields: [
      f("code", ["customer code", "customer id", "code", "customer no", "رقم العميل"], true, code(80)),
      f("name", ["customer name", "name", "اسم العميل"], true, text(300)),
      f("city", ["city", "town", "المدينة"], false, text(100)),
      f("customerType", ["customer type", "type", "category", "customer category"], false, text(100)),
      f("segment", ["segment", "customer segment", "sector"], false, segment),
      f("paymentTermsDays", ["payment terms", "payment terms days", "terms", "credit days"], false, days),
      f("creditLimit", ["credit limit", "limit"], false, nonNegativeMoney),
      accountOwner,
      f("active", ["active", "is active", "status"], false, bool, true),
    ],
  },

  sales: {
    kind: "sales",
    title: "Sales and returns (E03)",
    key: (v) => k(v.invoiceNo, v.lineNo),
    notFuture: ["invoiceDate"],
    fields: [
      f("invoiceNo", ["invoice no", "invoice number", "invoice id", "invoice", "inv no", "document no", "doc no", "رقم الفاتورة"], true, code(80)),
      f("lineNo", ["line no", "line id", "line number", "line", "row id"], true, code(40)),
      f("invoiceDate", ["invoice date", "date", "doc date", "document date", "تاريخ الفاتورة"], true, date),
      // Optional, but it is what lets a customer's payment lateness be measured for invoices that are paid before
      // the first unpaid-invoice snapshot (E05 carries the due date only while an invoice is unpaid).
      f("dueDate", ["due date", "contractual due date", "due", "maturity date", "تاريخ الاستحقاق"], false, date),
      f("docType", ["doc type", "document type", "type", "transaction type"], false, docType),
      customerCode,
      productCode(true),
      f("quantity", ["quantity", "qty", "signed quantity", "signed qty", "الكمية"], true, quantity),
      f("netSales", ["net sales", "net amount", "net sales jod", "net value", "sales", "amount", "المبيعات"], true, money),
      f("productCost", ["product cost", "cost", "cost jod", "total cost", "التكلفة"], false, money),
      f("projectRef", ["project", "project ref", "project no", "order ref", "order no", "project order"], false, code(80)),
      accountOwner,
    ],
    // No document type column: a negative quantity is a return, anything else an invoice line.
    derive: (v) => {
      if (v.docType == null) v.docType = Number(v.quantity) < 0 ? "return" : "invoice";
    },
    check: (v) => {
      if (v.dueDate != null && String(v.dueDate) < String(v.invoiceDate)) return "due date is before the invoice date";
      if (v.docType === "return" && Number(v.quantity) > 0) return "a return must have a negative quantity";
      if (v.docType === "return" && Number(v.netSales) > 0) return "a return must have negative net sales";
      return null;
    },
  },

  receipts: {
    kind: "receipts",
    title: "Customer receipts (E04)",
    key: (v) => k(v.receiptNo, v.allocationRowId),
    notFuture: ["receiptDate"],
    fields: [
      f("receiptNo", ["receipt no", "receipt id", "receipt number", "receipt", "voucher no", "رقم السند"], true, code(80)),
      f("allocationRowId", ["allocation row id", "allocation id", "allocation row", "allocation no", "alloc id", "row id"], true, code(80)),
      f("receiptDate", ["receipt date", "date", "voucher date", "تاريخ السند"], true, date),
      customerCode,
      f("invoiceNo", ["invoice no", "invoice id", "invoice number", "invoice", "allocated invoice"], false, code(80)),
      f("allocatedAmount", ["allocated amount", "allocated", "allocated jod", "amount", "amount jod"], true, money),
      f("receiptTotal", ["receipt total", "total received", "receipt amount", "total"], false, money),
    ],
    // Allocation rows must add up to the receipt total, otherwise cash is counted twice or lost.
    checkGroups: (rows) => {
      const byReceipt = new Map<string, RowRef[]>();
      for (const r of rows) byReceipt.set(String(r.values.receiptNo), [...(byReceipt.get(String(r.values.receiptNo)) ?? []), r]);
      const out = new Map<number, string>();
      for (const [receiptNo, list] of byReceipt) {
        const totals = new Set(list.map((r) => r.values.receiptTotal).filter((t) => t != null).map(fils));
        if (totals.size === 0) continue;
        const allocated = list.reduce((s, r) => s + fils(r.values.allocatedAmount), 0);
        const [total] = totals;
        let reason: string | null = null;
        if (totals.size > 1) reason = `receipt ${receiptNo}: rows state different receipt totals`;
        else if (total !== allocated)
          reason = `receipt ${receiptNo}: allocations in this file add to ${(allocated / 1000).toFixed(3)} but the receipt total is ${(total / 1000).toFixed(3)}`;
        if (reason) for (const r of list) out.set(r.row, reason);
      }
      return out;
    },
  },

  open_invoices: {
    kind: "open_invoices",
    title: "Unpaid invoices (E05)",
    snapshot: true,
    key: (v) => k(v.invoiceNo),
    notFuture: ["invoiceDate", "snapshotDate"],
    fields: [
      snapshotDate,
      f("invoiceNo", ["invoice no", "invoice id", "invoice number", "invoice", "رقم الفاتورة"], true, code(80)),
      customerCode,
      f("invoiceDate", ["invoice date", "date", "تاريخ الفاتورة"], true, date),
      f("dueDate", ["due date", "contractual due date", "due", "maturity date", "تاريخ الاستحقاق"], false, date),
      f("remainingAmount", ["remaining amount", "remaining", "outstanding", "outstanding amount", "balance", "remaining jod"], true, money),
      accountOwner,
    ],
    check: (v) => (v.dueDate != null && String(v.dueDate) < String(v.invoiceDate) ? "due date is before the invoice date" : null),
  },

  stock_snapshot: {
    kind: "stock_snapshot",
    title: "Stock by batch (E06)",
    snapshot: true,
    key: (v) => k(v.productCode, v.warehouse, v.batch),
    notFuture: ["snapshotDate"],
    fields: [
      snapshotDate,
      productCode(true),
      f("warehouse", ["warehouse", "store", "location", "المستودع"], true, code(80)),
      f("batch", ["batch", "batch no", "lot", "lot no", "رقم الدفعة"], false, code(80), ""),
      f("quantity", ["quantity", "qty", "on hand", "quantity on hand", "الكمية"], true, quantity),
      f("unitCost", ["unit cost", "cost", "cost per unit", "تكلفة الوحدة"], false, nonNegativeMoney),
      f("expiryDate", ["expiry date", "expiry", "exp date", "expiration date", "تاريخ الانتهاء"], false, date),
      f("owned", ["owned", "ownership", "owned by sadaf", "owner"], false, ownership, true),
    ],
  },

  stock_transactions: {
    kind: "stock_transactions",
    title: "Stock transactions (E07)",
    key: (v) => k(v.transactionId),
    notFuture: ["txDate"],
    fields: [
      f("transactionId", ["transaction id", "transaction no", "tx id", "movement id", "txn id", "trans id"], true, code(80)),
      f("txDate", ["transaction date", "tx date", "date", "movement date", "التاريخ"], true, date),
      productCode(true),
      f("batch", ["batch", "batch no", "lot", "lot no"], false, code(80), ""),
      f("warehouse", ["warehouse", "store", "location"], true, code(80)),
      f("txType", ["transaction type", "tx type", "movement type", "type"], true, stockTxType),
      f("quantity", ["quantity", "qty", "signed quantity", "signed qty"], true, quantity),
    ],
  },

  installed_units: {
    kind: "installed_units",
    title: "Installed equipment (E11 or manual)",
    key: (v) => k(v.code),
    fields: [
      f("code", ["unit code", "unit id", "serial", "serial no", "asset code", "equipment code", "code"], true, code(80)),
      customerCode,
      productCode(false),
      f("name", ["unit name", "equipment", "equipment name", "name", "description"], true, text(300)),
      f("installedOn", ["installed on", "install date", "installation date", "installed"], false, date),
      f("warrantyEnd", ["warranty end", "warranty expiry", "warranty end date", "warranty"], false, date),
      f("service", ["service", "service status", "agreement status", "contract status"], false, serviceStatus),
      f("expectedMonthlyConsumables", ["expected monthly consumables", "monthly consumables", "expected consumables"], false, nonNegativeMoney),
    ],
    check: (v) =>
      v.installedOn != null && v.warrantyEnd != null && String(v.warrantyEnd) < String(v.installedOn) ? "warranty ends before the installation date" : null,
  },
  tenders: {
    kind: "tenders",
    title: "Tender list (tender department)",
    key: (v) => k(v.authority, v.tenderNo ?? `title:${String(v.title).toLowerCase()}`),
    fields: [
      f("authority", ["authority", "institution", "hospital", "buyer", "جهة العطاء"], true, tenderAuthority),
      f("tenderNo", ["tender no", "tender number", "tender ref", "tender reference", "rfp no", "رقم العطاء"], false, code(80)),
      f("title", ["title", "tender title", "tender name", "description", "tender description", "اسم العطاء"], true, text(300)),
      f("productLine", ["product line", "tender line", "type of supply", "equipment or consumables"], true, tenderLine),
      f("status", ["status", "stage", "tender status", "tender stage", "الحالة"], false, tenderStatus),
      f("estimatedValue", ["estimated value", "estimate", "tender value", "القيمة التقديرية"], false, nonNegativeMoney),
      f("deadline", ["deadline", "submission deadline", "closing date", "due date", "آخر موعد"], false, date),
      f("bidValue", ["bid value", "our bid", "offer value", "bid amount"], false, nonNegativeMoney),
      f("awardAmount", ["award amount", "awarded amount", "award value"], false, nonNegativeMoney),
      f("closeReason", ["close reason", "reason lost", "reason cancelled", "loss reason", "reason"], false, text(1000)),
      f("contractNo", ["contract no", "contract number", "po no", "po number", "contract or po number"], false, code(80)),
      f("contractValue", ["contract value", "po value"], false, nonNegativeMoney),
      f("deliveredOn", ["delivered on", "delivery date", "date delivered"], false, date),
      f("notes", ["notes", "note", "remarks", "ملاحظات"], false, text(2000)),
    ],
    // A tender loaded at a stage must carry what that stage needs, the same rule as moving it there in the Tenders section.
    check: (v) => {
      const fields: TenderFields = {
        tenderNo: asText(v.tenderNo),
        estimatedValue: asNumber(v.estimatedValue),
        deadline: asText(v.deadline),
        bidValue: asNumber(v.bidValue),
        awardAmount: asNumber(v.awardAmount),
        closeReason: asText(v.closeReason),
        contractNo: asText(v.contractNo),
        contractValue: asNumber(v.contractValue),
        deliveredOn: asText(v.deliveredOn),
      };
      const missing = missingFor((asText(v.status) ?? "pipeline") as TenderStatus, fields);
      return missing.length > 0 ? `a tender at this stage also needs: ${missing.join(", ")}` : null;
    },
  },

  sales_people: {
    kind: "sales_people",
    title: "Sales force and targets (manual)",
    key: (v) => k(String(v.name).toLowerCase()),
    fields: [
      f("name", ["name", "sales person", "salesperson", "sales rep", "full name", "employee", "الاسم"], true, text(NAME_MAX)),
      f("email", ["email", "e-mail", "mail", "البريد"], false, text(EMAIL_MAX)),
      f("suppliers", ["suppliers", "supplier companies", "supplier", "represents", "الموردون"], false, semicolonList(SUPPLIERS_MAX, SUPPLIER_NAME_MAX)),
      f("monthlySalesTarget", ["monthly sales target", "sales target", "monthly target", "target", "الهدف الشهري"], false, nonNegativeMoney),
      f("newAccountsTarget", ["new accounts target", "new accounts", "new accounts per month"], false, wholeNumber(NEW_ACCOUNTS_MAX)),
      f("visitsPerWeek", ["visits per week", "weekly visits", "visits"], false, wholeNumber(VISITS_MAX)),
      f("active", ["active", "is active", "نشط"], false, bool),
    ],
    check: (v) => (v.email != null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v.email)) ? "not a valid email address" : null),
  },
};
