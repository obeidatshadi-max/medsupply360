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
    /** The person's name as typed on the form. A department shares one sign-in, so `userId` alone does not say who. */
    submittedBy: varchar("submitted_by", { length: 80 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_action_created_idx").on(t.action, t.createdAt), index("audit_company_created_idx").on(t.companyId, t.createdAt)],
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
  "tender_results", // award results from the authorities, plus our own bids
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

/**
 * The sales force: people the CEO makes responsible for products, customer accounts and tenders. They do not need a
 * login, so this is a list the owner keeps. A person turned off stays on what they already hold but cannot be chosen
 * for anything new.
 */
export const salesPeople = pgTable(
  "sales_people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    name: varchar("name", { length: 80 }).notNull(),
    email: varchar("email", { length: 255 }),
    /** Supplier companies this person represents, as they appear in the product list. */
    supplierNames: text("supplier_names").array().notNull().default(sql`'{}'::text[]`),
    /** What the CEO expects of this person. All optional. */
    monthlySalesTarget: numeric("monthly_sales_target", { precision: 14, scale: 3 }),
    newAccountsTarget: integer("new_accounts_target"),
    visitsPerWeek: integer("visits_per_week"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("sales_people_company_id_uniq").on(t.companyId, t.id), uniqueIndex("sales_people_name_uniq").using("btree", t.companyId, sql`lower(${t.name})`)],
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
    /** The sales person the CEO assigned to this product. Never touched by an import. */
    salesPersonId: uuid("sales_person_id"),
  },
  (t) => [
    foreignKey({ columns: [t.companyId, t.salesPersonId], foreignColumns: [salesPeople.companyId, salesPeople.id] }),
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
    /** The sales person the CEO assigned to this account. Never touched by an import. */
    salesPersonId: uuid("sales_person_id"),
  },
  (t) => [
    foreignKey({ columns: [t.companyId, t.salesPersonId], foreignColumns: [salesPeople.companyId, salesPeople.id] }),
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

// ─── Tenders ────────────────────────────────────────────────────────────────
// Entered by the tender department (and, in a later step, finance) as each tender moves through its stages.
// Status values and the legal moves between them live in src/core/tender-flow.ts.

export const tenderAuthority = pgEnum("tender_authority", ["MOH", "KHCC", "DRMS", "JUH", "KAUH"]);
export const tenderLine = pgEnum("tender_line", ["equipment", "consumables", "mixed"]);
export const tenderStatus = pgEnum("tender_status", [
  "pipeline",
  "open",
  "preparing",
  "submitted",
  "technical_review",
  "financial_review",
  "won",
  "lost",
  "cancelled",
  "contracted",
  "delivered",
  "collected",
]);

export const tenders = pgTable(
  "tenders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    authority: tenderAuthority("authority").notNull(),
    tenderNo: varchar("tender_no", { length: 80 }),
    title: varchar("title", { length: 300 }).notNull(),
    productLine: tenderLine("product_line").notNull(),
    status: tenderStatus("status").notNull().default("pipeline"),
    /** When the tender entered its current status; "days in stage" counts from here. */
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }).notNull().defaultNow(),
    estimatedValue: numeric("estimated_value", { precision: 14, scale: 3 }),
    deadline: date("deadline"),
    bidValue: numeric("bid_value", { precision: 14, scale: 3 }),
    awardAmount: numeric("award_amount", { precision: 14, scale: 3 }),
    /** Why a tender was lost or cancelled. */
    closeReason: text("close_reason"),
    contractNo: varchar("contract_no", { length: 80 }),
    contractValue: numeric("contract_value", { precision: 14, scale: 3 }),
    deliveredOn: date("delivered_on"),
    notes: text("notes"),
    /** Who is responsible for this tender; set by the CEO. Null until someone is assigned. */
    ownerId: uuid("owner_id"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("tenders_company_id_uniq").on(t.companyId, t.id),
    // The same number may exist at two authorities; at one authority it identifies one tender. NULL numbers (pipeline) never clash.
    uniqueIndex("tenders_authority_no_uniq").on(t.companyId, t.authority, t.tenderNo),
    index("tenders_status_idx").on(t.companyId, t.status),
    foreignKey({ columns: [t.companyId, t.ownerId], foreignColumns: [salesPeople.companyId, salesPeople.id] }),
  ],
);

/** Every status change: who moved the tender, from where to where, when, and the note they gave. */
export const tenderStatusLog = pgTable(
  "tender_status_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    tenderId: uuid("tender_id").notNull(),
    fromStatus: tenderStatus("from_status"),
    toStatus: tenderStatus("to_status").notNull(),
    userId: uuid("user_id").references(() => users.id),
    /** The person's typed name; see `auditLogs.submittedBy`. */
    submittedBy: varchar("submitted_by", { length: 80 }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tender_status_log_tender_idx").on(t.tenderId, t.createdAt),
    foreignKey({ columns: [t.companyId, t.tenderId], foreignColumns: [tenders.companyId, tenders.id] }),
  ],
);

export const guaranteeKind = pgEnum("guarantee_kind", ["bid", "performance"]);

/** Bank guarantees posted for a tender. Money held by an active (unreturned, unexpired) guarantee is cash tied up. */
export const tenderGuarantees = pgTable(
  "tender_guarantees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    tenderId: uuid("tender_id").notNull(),
    kind: guaranteeKind("kind").notNull(),
    amount: numeric("amount", { precision: 14, scale: 3 }).notNull(),
    issuedOn: date("issued_on"),
    expiresOn: date("expires_on").notNull(),
    returnedOn: date("returned_on"),
    reference: varchar("reference", { length: 80 }),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tender_guarantees_tender_idx").on(t.companyId, t.tenderId),
    foreignKey({ columns: [t.companyId, t.tenderId], foreignColumns: [tenders.companyId, tenders.id] }),
  ],
);

/** Invoices raised to the authority for a delivered tender, with how much has been collected so far. */
export const tenderInvoices = pgTable(
  "tender_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    tenderId: uuid("tender_id").notNull(),
    invoiceNo: varchar("invoice_no", { length: 80 }).notNull(),
    invoiceDate: date("invoice_date").notNull(),
    amount: numeric("amount", { precision: 14, scale: 3 }).notNull(),
    collectedAmount: numeric("collected_amount", { precision: 14, scale: 3 }).notNull().default("0"),
    /** Date of the latest payment received on this invoice. */
    lastCollectedOn: date("last_collected_on"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("tender_invoices_no_uniq").on(t.companyId, t.tenderId, t.invoiceNo),
    foreignKey({ columns: [t.companyId, t.tenderId], foreignColumns: [tenders.companyId, tenders.id] }),
  ],
);

// ─── Tender price history ───────────────────────────────────────────────────
// What the authorities awarded, item by item, and who bid what. Kept apart from `tenders` (the live workflow) so a
// four-year archive never shows up in the pipeline or the owner's overview. Filled only by the "Tender results" import.
// Missing is NULL: an authority that publishes only the winner leaves the other bidders' prices unknown, not zero.

export const tenderBidOutcome = pgEnum("tender_bid_outcome", ["won", "lost", "disqualified", "withdrawn", "unknown"]);

/** One tender as the authority ran it. Created by the import from the rows that mention it. */
export const tenderArchive = pgTable(
  "tender_archive",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    authority: tenderAuthority("authority").notNull(),
    tenderNo: varchar("tender_no", { length: 80 }).notNull(),
    title: varchar("title", { length: 300 }),
    awardDate: date("award_date").notNull(),
    /** The live tender this belongs to, when we recorded it in the Tenders section. */
    tenderId: uuid("tender_id"),
    importBatchId: uuid("import_batch_id").references(() => importBatches.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("tender_archive_company_id_uniq").on(t.companyId, t.id),
    uniqueIndex("tender_archive_authority_no_uniq").on(t.companyId, t.authority, t.tenderNo),
    index("tender_archive_date_idx").on(t.companyId, t.awardDate),
    foreignKey({ columns: [t.companyId, t.tenderId], foreignColumns: [tenders.companyId, tenders.id] }),
  ],
);

/** One item the authority asked for. `lineRef` is the item code, or the item name when there is no code. */
export const tenderArchiveLines = pgTable(
  "tender_archive_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    archiveId: uuid("archive_id").notNull(),
    lineRef: varchar("line_ref", { length: 300 }).notNull(),
    itemCode: varchar("item_code", { length: 80 }),
    itemName: varchar("item_name", { length: 300 }).notNull(),
    /** Set when the item code is in the product list; the price history for a product reads from here. */
    productId: uuid("product_id"),
    therapeuticArea: varchar("therapeutic_area", { length: 100 }),
    quantity: numeric("quantity", { precision: 14, scale: 3 }),
    unit: varchar("unit", { length: 30 }),
    importBatchId: uuid("import_batch_id").references(() => importBatches.id),
  },
  (t) => [
    unique("tender_archive_lines_company_id_uniq").on(t.companyId, t.id),
    uniqueIndex("tender_archive_lines_ref_uniq").on(t.companyId, t.archiveId, t.lineRef),
    index("tender_archive_lines_product_idx").on(t.companyId, t.productId),
    foreignKey({ columns: [t.companyId, t.archiveId], foreignColumns: [tenderArchive.companyId, tenderArchive.id] }),
    foreignKey({ columns: [t.companyId, t.productId], foreignColumns: [products.companyId, products.id] }),
  ],
);

/** One bidder's offer on one item. `isOwn` marks our own bids. */
export const tenderBids = pgTable(
  "tender_bids",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    lineId: uuid("line_id").notNull(),
    bidder: varchar("bidder", { length: 200 }).notNull(),
    /** The bidder's name in lower case: "Ibn Sina" and "IBN SINA" in two files are one bidder. */
    bidderKey: varchar("bidder_key", { length: 200 }).notNull(),
    isOwn: boolean("is_own").notNull().default(false),
    unitPrice: numeric("unit_price", { precision: 14, scale: 3 }),
    /** JOD unless the authority priced in something else. Prices in different currencies are never compared. */
    currency: varchar("currency", { length: 3 }).notNull().default("JOD"),
    outcome: tenderBidOutcome("outcome").notNull().default("unknown"),
    technicalPass: boolean("technical_pass"),
    awardedQuantity: numeric("awarded_quantity", { precision: 14, scale: 3 }),
    brand: varchar("brand", { length: 200 }),
    importBatchId: uuid("import_batch_id").references(() => importBatches.id),
  },
  (t) => [
    uniqueIndex("tender_bids_bidder_uniq").on(t.companyId, t.lineId, t.bidderKey),
    index("tender_bids_line_idx").on(t.companyId, t.lineId),
    foreignKey({ columns: [t.companyId, t.lineId], foreignColumns: [tenderArchiveLines.companyId, tenderArchiveLines.id] }),
  ],
);
