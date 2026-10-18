/**
 * Sadaf 360 schema.
 *
 * Multi-tenant from day one: every business table carries company_id and every query must filter by it.
 * Money is JOD numeric(14,3) (the dinar has 1,000 fils). Dates that come from the ERP are `date`, not timestamps.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["owner", "admin", "viewer", "tender", "finance"]);

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("JOD"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: varchar("full_name", { length: 200 }).notNull(),
    role: userRole("role").notNull().default("viewer"),
    active: boolean("active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    /** Sessions issued before this moment are rejected (set on password reset). */
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // One account per email address, case-insensitively: login, create-user and bootstrap all look users up by lower(email).
  (t) => [index("users_company_idx").on(t.companyId), uniqueIndex("users_email_lower_uniq").using("btree", sql`lower(${t.email})`)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").references(() => companies.id),
    userId: uuid("user_id").references(() => users.id),
    action: varchar("action", { length: 80 }).notNull(),
    entityType: varchar("entity_type", { length: 60 }),
    entityId: varchar("entity_id", { length: 80 }),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_action_created_idx").on(t.action, t.createdAt)],
);

/** One-time password-reset links. Only the SHA-256 of the token is stored, so a database leak cannot be replayed. */
export const passwordResets = pgTable(
  "password_resets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("password_resets_user_idx").on(t.userId)],
);

// ─── Business data (Alpha ERP exports E01–E07, plus installed units) ─────────
//
// Rules for every table below:
//  - company_id on every row; a child row's parent must belong to the same company (composite foreign keys).
//  - ERP codes are unique per company, so re-importing a file updates rows instead of duplicating them.
//  - import_batch_id records which file a row came from, so every figure can show its source.
//  - Quantities and money are signed: returns are negative. Money is JOD numeric(14,3).
//  - Missing is NULL, never 0: an unknown due date or segment must stay unknown.

export const productLine = pgEnum("product_line", ["Equipment", "Devices", "Consumables"]);
export const customerSegment = pgEnum("customer_segment", ["Tender", "Private"]);
export const docType = pgEnum("doc_type", ["invoice", "return"]);
export const stockTxType = pgEnum("stock_tx_type", ["customer_issue", "customer_return", "transfer", "purchase_receipt", "adjustment"]);
export const serviceStatus = pgEnum("service_status", ["Active", "Expiring", "No contract"]);
export const importKind = pgEnum("import_kind", [
  "products", // E01
  "customers", // E02
  "sales", // E03
  "receipts", // E04
  "open_invoices", // E05
  "stock_snapshot", // E06
  "stock_transactions", // E07
  "installed_units", // E11 / manual
]);
export const importStatus = pgEnum("import_status", ["accepted", "partial", "rejected"]);

/** One uploaded file. The file hash blocks accidental double upload; snapshot_date marks point-in-time files (E05, E06). */
export const importBatches = pgTable(
  "import_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    kind: importKind("kind").notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileSha256: varchar("file_sha256", { length: 64 }).notNull(),
    snapshotDate: date("snapshot_date"),
    rowsTotal: integer("rows_total").notNull(),
    rowsAccepted: integer("rows_accepted").notNull(),
    rowsRejected: integer("rows_rejected").notNull(),
    status: importStatus("status").notNull(),
    /** First rejected rows with the reason (capped by the importer). */
    rejections: jsonb("rejections").$type<{ row: number; reason: string }[]>(),
    importedBy: uuid("imported_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("import_batches_company_id_uniq").on(t.companyId, t.id),
    uniqueIndex("import_batches_file_uniq").on(t.companyId, t.kind, t.fileSha256),
    index("import_batches_company_kind_idx").on(t.companyId, t.kind, t.createdAt),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    code: varchar("code", { length: 80 }).notNull(),
    name: varchar("name", { length: 300 }).notNull(),
    line: productLine("line").notNull(),
    /** Clinical / therapeutic area (for example "Respiratory"). NULL until the ERP or the owner supplies it; never defaulted. */
    therapeuticArea: varchar("therapeutic_area", { length: 100 }),
    manufacturer: varchar("manufacturer", { length: 200 }),
    supplierCode: varchar("supplier_code", { length: 80 }),
    supplierName: varchar("supplier_name", { length: 200 }),
    unit: varchar("unit", { length: 30 }),
    /** Counting units per pack, when the ERP counts in packs. */
    packConversion: numeric("pack_conversion", { precision: 14, scale: 3 }),
    tracksExpiry: boolean("tracks_expiry").notNull().default(false),
    active: boolean("active").notNull().default(true),
    importBatchId: uuid("import_batch_id"),
  },
  (t) => [
    unique("products_company_id_uniq").on(t.companyId, t.id),
    uniqueIndex("products_company_code_uniq").on(t.companyId, t.code),
    foreignKey({ columns: [t.companyId, t.importBatchId], foreignColumns: [importBatches.companyId, importBatches.id] }),
  ],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    code: varchar("code", { length: 80 }).notNull(),
    name: varchar("name", { length: 300 }).notNull(),
    city: varchar("city", { length: 100 }),
    customerType: varchar("customer_type", { length: 100 }),
    /** NULL = not yet classified. Never defaulted to Private. */
    segment: customerSegment("segment"),
    paymentTermsDays: integer("payment_terms_days"),
    creditLimit: numeric("credit_limit", { precision: 14, scale: 3 }),
    accountOwner: varchar("account_owner", { length: 200 }),
    active: boolean("active").notNull().default(true),
    importBatchId: uuid("import_batch_id"),
  },
  (t) => [
    unique("customers_company_id_uniq").on(t.companyId, t.id),
    uniqueIndex("customers_company_code_uniq").on(t.companyId, t.code),
    foreignKey({ columns: [t.companyId, t.importBatchId], foreignColumns: [importBatches.companyId, importBatches.id] }),
  ],
);

/** Invoice header. Created by the sales file (E03) or the unpaid-invoice file (E05), whichever arrives first. */
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    invoiceNo: varchar("invoice_no", { length: 80 }).notNull(),
    customerId: uuid("customer_id").notNull(),
    invoiceDate: date("invoice_date").notNull(),
    /** Contractual due date. NULL until the ERP supplies it: aging and lateness must show "Data missing", not guess. */
    dueDate: date("due_date"),
    accountOwner: varchar("account_owner", { length: 200 }),
    importBatchId: uuid("import_batch_id"),
  },
  (t) => [
    unique("invoices_company_id_uniq").on(t.companyId, t.id),
    uniqueIndex("invoices_company_no_uniq").on(t.companyId, t.invoiceNo),
    index("invoices_customer_date_idx").on(t.companyId, t.customerId, t.invoiceDate),
    foreignKey({ columns: [t.companyId, t.customerId], foreignColumns: [customers.companyId, customers.id] }),
    foreignKey({ columns: [t.companyId, t.importBatchId], foreignColumns: [importBatches.companyId, importBatches.id] }),
  ],
);

/** E03 sales and returns, one row per invoice line. Returns carry negative quantity, sales and cost. */
export const salesLines = pgTable(
  "sales_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    invoiceId: uuid("invoice_id").notNull(),
    lineNo: varchar("line_no", { length: 40 }).notNull(),
    docType: docType("doc_type").notNull().default("invoice"),
    productId: uuid("product_id").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    /** Net of tax. */
    netSales: numeric("net_sales", { precision: 14, scale: 3 }).notNull(),
    productCost: numeric("product_cost", { precision: 14, scale: 3 }),
    /** Project or order link, required to attach direct project costs later. */
    projectRef: varchar("project_ref", { length: 80 }),
    importBatchId: uuid("import_batch_id"),
  },
  (t) => [
    uniqueIndex("sales_lines_invoice_line_uniq").on(t.companyId, t.invoiceId, t.lineNo),
    index("sales_lines_product_idx").on(t.companyId, t.productId),
    foreignKey({ columns: [t.companyId, t.invoiceId], foreignColumns: [invoices.companyId, invoices.id] }),
    foreignKey({ columns: [t.companyId, t.productId], foreignColumns: [products.companyId, products.id] }),
    foreignKey({ columns: [t.companyId, t.importBatchId], foreignColumns: [importBatches.companyId, importBatches.id] }),
  ],
);

/** E04 customer receipts, one row per allocation. invoice_id NULL = unapplied cash, counted once and shown separately. */
export const receipts = pgTable(
  "receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    receiptNo: varchar("receipt_no", { length: 80 }).notNull(),
    allocationRowId: varchar("allocation_row_id", { length: 80 }).notNull(),
    receiptDate: date("receipt_date").notNull(),
    customerId: uuid("customer_id").notNull(),
    invoiceId: uuid("invoice_id"),
    allocatedAmount: numeric("allocated_amount", { precision: 14, scale: 3 }).notNull(),
    importBatchId: uuid("import_batch_id"),
  },
  (t) => [
    uniqueIndex("receipts_alloc_uniq").on(t.companyId, t.receiptNo, t.allocationRowId),
    index("receipts_customer_date_idx").on(t.companyId, t.customerId, t.receiptDate),
    foreignKey({ columns: [t.companyId, t.customerId], foreignColumns: [customers.companyId, customers.id] }),
    foreignKey({ columns: [t.companyId, t.invoiceId], foreignColumns: [invoices.companyId, invoices.id] }),
    foreignKey({ columns: [t.companyId, t.importBatchId], foreignColumns: [importBatches.companyId, importBatches.id] }),
  ],
);

/** E05 unpaid invoices as of a snapshot date. A new file for the same date replaces that date's rows; dates are never summed. */
export const openInvoiceSnapshots = pgTable(
  "open_invoice_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    snapshotDate: date("snapshot_date").notNull(),
    invoiceId: uuid("invoice_id").notNull(),
    remainingAmount: numeric("remaining_amount", { precision: 14, scale: 3 }).notNull(),
    importBatchId: uuid("import_batch_id"),
  },
  (t) => [
    uniqueIndex("open_invoice_snapshots_uniq").on(t.companyId, t.snapshotDate, t.invoiceId),
    foreignKey({ columns: [t.companyId, t.invoiceId], foreignColumns: [invoices.companyId, invoices.id] }),
    foreignKey({ columns: [t.companyId, t.importBatchId], foreignColumns: [importBatches.companyId, importBatches.id] }),
  ],
);

/** E06 stock by batch as of a snapshot date. owned = false for stock held but not owned by Sadaf (excluded from values). */
export const stockSnapshots = pgTable(
  "stock_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    snapshotDate: date("snapshot_date").notNull(),
    productId: uuid("product_id").notNull(),
    warehouse: varchar("warehouse", { length: 80 }).notNull(),
    /** Empty string, not NULL, when the product has no batches, so the unique key below still works. */
    batch: varchar("batch", { length: 80 }).notNull().default(""),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 14, scale: 3 }),
    expiryDate: date("expiry_date"),
    owned: boolean("owned").notNull().default(true),
    importBatchId: uuid("import_batch_id"),
  },
  (t) => [
    uniqueIndex("stock_snapshots_uniq").on(t.companyId, t.snapshotDate, t.productId, t.warehouse, t.batch),
    foreignKey({ columns: [t.companyId, t.productId], foreignColumns: [products.companyId, products.id] }),
    foreignKey({ columns: [t.companyId, t.importBatchId], foreignColumns: [importBatches.companyId, importBatches.id] }),
  ],
);

/** E07 stock movements. Customer issues are the demand signal; transfers and adjustments must not be read as demand. */
export const stockTransactions = pgTable(
  "stock_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    transactionId: varchar("transaction_id", { length: 80 }).notNull(),
    txDate: date("tx_date").notNull(),
    productId: uuid("product_id").notNull(),
    batch: varchar("batch", { length: 80 }).notNull().default(""),
    warehouse: varchar("warehouse", { length: 80 }).notNull(),
    txType: stockTxType("tx_type").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    importBatchId: uuid("import_batch_id"),
  },
  (t) => [
    uniqueIndex("stock_tx_uniq").on(t.companyId, t.transactionId),
    index("stock_tx_product_date_idx").on(t.companyId, t.productId, t.txDate),
    foreignKey({ columns: [t.companyId, t.productId], foreignColumns: [products.companyId, products.id] }),
    foreignKey({ columns: [t.companyId, t.importBatchId], foreignColumns: [importBatches.companyId, importBatches.id] }),
  ],
);

/** Equipment installed at a customer (E11 or manual). Drives expected consumables, warranty and service renewal. */
export const installedUnits = pgTable(
  "installed_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    code: varchar("code", { length: 80 }).notNull(),
    customerId: uuid("customer_id").notNull(),
    productId: uuid("product_id"),
    name: varchar("name", { length: 300 }).notNull(),
    installedOn: date("installed_on"),
    warrantyEnd: date("warranty_end"),
    service: serviceStatus("service"),
    /** Estimated, not measured: consumables the unit should use per month (JOD). NULL = no estimate. */
    expectedMonthlyConsumables: numeric("expected_monthly_consumables", { precision: 14, scale: 3 }),
    importBatchId: uuid("import_batch_id"),
  },
  (t) => [
    uniqueIndex("installed_units_company_code_uniq").on(t.companyId, t.code),
    index("installed_units_customer_idx").on(t.companyId, t.customerId),
    foreignKey({ columns: [t.companyId, t.customerId], foreignColumns: [customers.companyId, customers.id] }),
    foreignKey({ columns: [t.companyId, t.productId], foreignColumns: [products.companyId, products.id] }),
    foreignKey({ columns: [t.companyId, t.importBatchId], foreignColumns: [importBatches.companyId, importBatches.id] }),
  ],
);
