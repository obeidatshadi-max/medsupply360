/**
 * Loads a validated ERP file into the database: one transaction per file, scoped to one company.
 *
 * - The same file (by hash) is refused a second time, so a double click cannot double the books.
 * - Rows are matched to products / customers / invoices by their ERP codes inside the company. A row that points at a
 *   code we do not have is rejected with a reason, never auto-created.
 * - Re-importing updates rows by their ERP key. Point-in-time files (unpaid invoices, stock by batch) replace that
 *   snapshot date's rows; different dates are kept side by side and never summed.
 * - A dry run does every check and builds the reconciliation summary but writes nothing.
 *
 * Takes the database as a parameter so tests can run it on PGlite; the request plumbing lives in the server action.
 */
import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { PgColumn, PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { reconcile, type SummaryLine } from "@/core/import/reconcile";
import { validateImport, type Issue } from "@/core/import/validate";
import { SPECS, type ImportKind, type RowRef } from "@/core/import/specs";
import * as schema from "./schema";
import {
  customers,
  importBatches,
  installedUnits,
  invoices,
  openInvoiceSnapshots,
  products,
  receipts,
  salesLines,
  stockSnapshots,
  stockTransactions,
  tenderArchive,
  tenderArchiveLines,
  tenderBids,
  tenders,
} from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export const MAX_STORED_REJECTIONS = 50;
const CHUNK = 500;

export interface RunImportInput {
  companyId: string;
  userId: string | null;
  kind: ImportKind;
  fileName: string;
  text: string;
  /** Import day, YYYY-MM-DD, in the business's own time zone. */
  today: string;
  /** For snapshot files with no snapshot date column. */
  snapshotDate?: string;
  dryRun: boolean;
}

export interface ImportOutcome {
  state: "fatal" | "already_imported" | "done";
  /** Reason, for the fatal and already-imported states. */
  message: string | null;
  dryRun: boolean;
  wrote: boolean;
  batchId: string | null;
  status: "accepted" | "partial" | "rejected" | null;
  rowsTotal: number;
  rowsAccepted: number;
  rowsRejected: number;
  rejections: Issue[];
  warnings: Issue[];
  summary: SummaryLine[];
  ignoredColumns: string[];
  mappedColumns: { field: string; sourceColumn: string }[];
  snapshotDate: string | null;
}

const blank = (input: RunImportInput, state: ImportOutcome["state"], message: string): ImportOutcome => ({
  state,
  message,
  dryRun: input.dryRun,
  wrote: false,
  batchId: null,
  status: null,
  rowsTotal: 0,
  rowsAccepted: 0,
  rowsRejected: 0,
  rejections: [],
  warnings: [],
  summary: [],
  ignoredColumns: [],
  mappedColumns: [],
  snapshotDate: null,
});

const ex = (c: PgColumn) => sql.raw(`excluded."${c.name}"`);
const str = (v: unknown) => v as string;
const strOrNull = (v: unknown) => (v == null ? null : (v as string));

async function inChunks<T>(items: T[], fn: (chunk: T[]) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += CHUNK) await fn(items.slice(i, i + CHUNK));
}

async function idsByCode(tx: Tx, table: typeof customers | typeof products, companyId: string, codes: string[]) {
  const out = new Map<string, string>();
  const unique = [...new Set(codes)];
  for (let i = 0; i < unique.length; i += 1000) {
    const rows = await tx
      .select({ id: table.id, code: table.code })
      .from(table)
      .where(and(eq(table.companyId, companyId), inArray(table.code, unique.slice(i, i + 1000))));
    for (const r of rows) out.set(r.code, r.id);
  }
  return out;
}

async function invoicesByNo(tx: Tx, companyId: string, numbers: string[]) {
  const out = new Map<string, { id: string; customerId: string }>();
  const unique = [...new Set(numbers)];
  for (let i = 0; i < unique.length; i += 1000) {
    const rows = await tx
      .select({ id: invoices.id, invoiceNo: invoices.invoiceNo, customerId: invoices.customerId })
      .from(invoices)
      .where(and(eq(invoices.companyId, companyId), inArray(invoices.invoiceNo, unique.slice(i, i + 1000))));
    for (const r of rows) out.set(r.invoiceNo, { id: r.id, customerId: r.customerId });
  }
  return out;
}

interface Resolved {
  rows: RowRef[];
  rejected: Issue[];
  warnings: Issue[];
  customerIds: Map<string, string>;
  productIds: Map<string, string>;
  invoiceIds: Map<string, { id: string; customerId: string }>;
}

/** Looks up every code a file points at. Rows that point at something unknown are rejected here, with the reason. */
async function resolve(tx: Tx, companyId: string, kind: ImportKind, input: RowRef[]): Promise<Resolved> {
  const rejected: Issue[] = [];
  const warnings: Issue[] = [];
  const values = (k: string) => input.map((r) => r.values[k]).filter((v): v is string => typeof v === "string");

  const needsCustomers = ["sales", "receipts", "open_invoices", "installed_units"].includes(kind);
  const needsProducts = ["sales", "stock_snapshot", "stock_transactions", "installed_units"].includes(kind);
  // Tender results name items by the authority's own code, which is often not in our product list: such an item is kept
  // as text and a warning says so, instead of rejecting years of history.
  const looksUpItems = kind === "tender_results";
  const customerIds = needsCustomers ? await idsByCode(tx, customers, companyId, values("customerCode")) : new Map<string, string>();
  const productIds = needsProducts
    ? await idsByCode(tx, products, companyId, values("productCode"))
    : looksUpItems
      ? await idsByCode(tx, products, companyId, values("itemCode"))
      : new Map<string, string>();
  const invoiceIds =
    kind === "sales" || kind === "open_invoices" || kind === "receipts"
      ? await invoicesByNo(tx, companyId, values("invoiceNo"))
      : new Map<string, { id: string; customerId: string }>();

  const headers = new Map<string, { customerCode: string; invoiceDate: string }>();
  const rows: RowRef[] = [];
  const unknownItemCodes = new Set<string>();
  for (const r of input) {
    const v = r.values;
    if (looksUpItems && typeof v.itemCode === "string" && !productIds.has(v.itemCode) && !unknownItemCodes.has(v.itemCode)) {
      unknownItemCodes.add(v.itemCode);
      warnings.push({ row: r.row, reason: `item code "${v.itemCode}" is not in the product list; the item is kept by its name and not linked to a product` });
    }
    const customerCode = strOrNull(v.customerCode);
    const productCode = strOrNull(v.productCode);
    if (needsCustomers && customerCode && !customerIds.has(customerCode)) {
      rejected.push({ row: r.row, reason: `unknown customer code "${customerCode}": import the customer list first` });
      continue;
    }
    if (needsProducts && productCode && !productIds.has(productCode)) {
      rejected.push({ row: r.row, reason: `unknown product code "${productCode}": import the product list first` });
      continue;
    }

    if (kind === "sales" || kind === "open_invoices") {
      const no = str(v.invoiceNo);
      const first = headers.get(no);
      if (first && (first.customerCode !== customerCode || first.invoiceDate !== v.invoiceDate)) {
        rejected.push({ row: r.row, reason: `invoice ${no} has a different customer or date on an earlier row` });
        continue;
      }
      const existing = invoiceIds.get(no);
      if (existing && customerCode && existing.customerId !== customerIds.get(customerCode)) {
        rejected.push({ row: r.row, reason: `invoice ${no} is already recorded for a different customer` });
        continue;
      }
      headers.set(no, { customerCode: customerCode!, invoiceDate: str(v.invoiceDate) });
    }

    if (kind === "receipts" && v.invoiceNo != null && !invoiceIds.has(str(v.invoiceNo))) {
      // Cash is real even if the invoice is older than our history: keep it once, as unlinked, and say so.
      warnings.push({ row: r.row, reason: `invoice ${v.invoiceNo} is not in the imported invoices; the cash is kept as not linked to an invoice` });
      rows.push({ row: r.row, values: { ...v, invoiceNo: null } });
      continue;
    }
    rows.push(r);
  }
  return { rows, rejected, warnings, customerIds, productIds, invoiceIds };
}

async function upsertInvoiceHeaders(tx: Tx, companyId: string, batchId: string, rows: RowRef[], customerIds: Map<string, string>) {
  const seen = new Map<string, (typeof invoices.$inferInsert)>();
  for (const r of rows) {
    const no = str(r.values.invoiceNo);
    if (seen.has(no)) continue;
    seen.set(no, {
      companyId,
      invoiceNo: no,
      customerId: customerIds.get(str(r.values.customerCode))!,
      invoiceDate: str(r.values.invoiceDate),
      dueDate: strOrNull(r.values.dueDate),
      accountOwner: strOrNull(r.values.accountOwner),
      importBatchId: batchId,
    });
  }
  const ids = new Map<string, string>();
  await inChunks([...seen.values()], async (chunk) => {
    const out = await tx
      .insert(invoices)
      .values(chunk)
      .onConflictDoUpdate({
        target: [invoices.companyId, invoices.invoiceNo],
        // A file that has no due date or owner must not erase one an earlier file supplied.
        set: {
          invoiceDate: ex(invoices.invoiceDate),
          dueDate: sql`coalesce(excluded."due_date", ${invoices.dueDate})`,
          accountOwner: sql`coalesce(excluded."account_owner", ${invoices.accountOwner})`,
          importBatchId: ex(invoices.importBatchId),
        },
      })
      .returning({ id: invoices.id, invoiceNo: invoices.invoiceNo });
    for (const o of out) ids.set(o.invoiceNo, o.id);
  });
  return ids;
}

async function write(tx: Tx, companyId: string, batchId: string, kind: ImportKind, rows: RowRef[], res: Resolved, snapshotDate: string | null) {
  const cust = (r: RowRef) => res.customerIds.get(str(r.values.customerCode))!;
  const prod = (r: RowRef) => res.productIds.get(str(r.values.productCode))!;

  switch (kind) {
    case "products":
      await inChunks(rows, (chunk) =>
        tx
          .insert(products)
          .values(
            chunk.map((r) => ({
              companyId,
              code: str(r.values.code),
              name: str(r.values.name),
              line: str(r.values.line) as (typeof products.$inferInsert)["line"],
              therapeuticArea: strOrNull(r.values.therapeuticArea),
              manufacturer: strOrNull(r.values.manufacturer),
              supplierCode: strOrNull(r.values.supplierCode),
              supplierName: strOrNull(r.values.supplierName),
              unit: strOrNull(r.values.unit),
              packConversion: strOrNull(r.values.packConversion),
              tracksExpiry: r.values.tracksExpiry === true,
              active: r.values.active !== false,
              importBatchId: batchId,
            })),
          )
          .onConflictDoUpdate({
            target: [products.companyId, products.code],
            set: {
              name: ex(products.name),
              line: ex(products.line),
              // Kept when a later file has no area column, so a hand-filled area is not wiped by an ERP re-import.
              therapeuticArea: sql`coalesce(excluded."therapeutic_area", ${products.therapeuticArea})`,
              manufacturer: ex(products.manufacturer),
              supplierCode: ex(products.supplierCode),
              supplierName: ex(products.supplierName),
              unit: ex(products.unit),
              packConversion: ex(products.packConversion),
              tracksExpiry: ex(products.tracksExpiry),
              active: ex(products.active),
              importBatchId: ex(products.importBatchId),
            },
          })
          .then(() => undefined),
      );
      return;

    case "customers":
      await inChunks(rows, (chunk) =>
        tx
          .insert(customers)
          .values(
            chunk.map((r) => ({
              companyId,
              code: str(r.values.code),
              name: str(r.values.name),
              city: strOrNull(r.values.city),
              customerType: strOrNull(r.values.customerType),
              segment: strOrNull(r.values.segment) as (typeof customers.$inferInsert)["segment"],
              paymentTermsDays: r.values.paymentTermsDays == null ? null : Number(r.values.paymentTermsDays),
              creditLimit: strOrNull(r.values.creditLimit),
              accountOwner: strOrNull(r.values.accountOwner),
              active: r.values.active !== false,
              importBatchId: batchId,
            })),
          )
          .onConflictDoUpdate({
            target: [customers.companyId, customers.code],
            set: {
              name: ex(customers.name),
              city: ex(customers.city),
              customerType: ex(customers.customerType),
              segment: ex(customers.segment),
              paymentTermsDays: ex(customers.paymentTermsDays),
              creditLimit: ex(customers.creditLimit),
              accountOwner: ex(customers.accountOwner),
              active: ex(customers.active),
              importBatchId: ex(customers.importBatchId),
            },
          })
          .then(() => undefined),
      );
      return;

    case "sales": {
      const ids = await upsertInvoiceHeaders(tx, companyId, batchId, rows, res.customerIds);
      await inChunks(rows, (chunk) =>
        tx
          .insert(salesLines)
          .values(
            chunk.map((r) => ({
              companyId,
              invoiceId: ids.get(str(r.values.invoiceNo))!,
              lineNo: str(r.values.lineNo),
              docType: str(r.values.docType) as (typeof salesLines.$inferInsert)["docType"],
              productId: prod(r),
              quantity: str(r.values.quantity),
              netSales: str(r.values.netSales),
              productCost: strOrNull(r.values.productCost),
              projectRef: strOrNull(r.values.projectRef),
              importBatchId: batchId,
            })),
          )
          .onConflictDoUpdate({
            target: [salesLines.companyId, salesLines.invoiceId, salesLines.lineNo],
            set: {
              docType: ex(salesLines.docType),
              productId: ex(salesLines.productId),
              quantity: ex(salesLines.quantity),
              netSales: ex(salesLines.netSales),
              productCost: ex(salesLines.productCost),
              projectRef: ex(salesLines.projectRef),
              importBatchId: ex(salesLines.importBatchId),
            },
          })
          .then(() => undefined),
      );
      return;
    }

    case "receipts":
      await inChunks(rows, (chunk) =>
        tx
          .insert(receipts)
          .values(
            chunk.map((r) => ({
              companyId,
              receiptNo: str(r.values.receiptNo),
              allocationRowId: str(r.values.allocationRowId),
              receiptDate: str(r.values.receiptDate),
              customerId: cust(r),
              invoiceId: r.values.invoiceNo == null ? null : res.invoiceIds.get(str(r.values.invoiceNo))!.id,
              allocatedAmount: str(r.values.allocatedAmount),
              importBatchId: batchId,
            })),
          )
          .onConflictDoUpdate({
            target: [receipts.companyId, receipts.receiptNo, receipts.allocationRowId],
            set: {
              receiptDate: ex(receipts.receiptDate),
              customerId: ex(receipts.customerId),
              invoiceId: ex(receipts.invoiceId),
              allocatedAmount: ex(receipts.allocatedAmount),
              importBatchId: ex(receipts.importBatchId),
            },
          })
          .then(() => undefined),
      );
      return;

    case "open_invoices": {
      const ids = await upsertInvoiceHeaders(tx, companyId, batchId, rows, res.customerIds);
      // A new file for a date replaces that date's rows; other dates are left alone.
      await tx.delete(openInvoiceSnapshots).where(and(eq(openInvoiceSnapshots.companyId, companyId), eq(openInvoiceSnapshots.snapshotDate, snapshotDate!)));
      await inChunks(rows, (chunk) =>
        tx
          .insert(openInvoiceSnapshots)
          .values(
            chunk.map((r) => ({
              companyId,
              snapshotDate: snapshotDate!,
              invoiceId: ids.get(str(r.values.invoiceNo))!,
              remainingAmount: str(r.values.remainingAmount),
              importBatchId: batchId,
            })),
          )
          .then(() => undefined),
      );
      return;
    }

    case "stock_snapshot":
      await tx.delete(stockSnapshots).where(and(eq(stockSnapshots.companyId, companyId), eq(stockSnapshots.snapshotDate, snapshotDate!)));
      await inChunks(rows, (chunk) =>
        tx
          .insert(stockSnapshots)
          .values(
            chunk.map((r) => ({
              companyId,
              snapshotDate: snapshotDate!,
              productId: prod(r),
              warehouse: str(r.values.warehouse),
              batch: str(r.values.batch),
              quantity: str(r.values.quantity),
              unitCost: strOrNull(r.values.unitCost),
              expiryDate: strOrNull(r.values.expiryDate),
              owned: r.values.owned !== false,
              importBatchId: batchId,
            })),
          )
          .then(() => undefined),
      );
      return;

    case "stock_transactions":
      await inChunks(rows, (chunk) =>
        tx
          .insert(stockTransactions)
          .values(
            chunk.map((r) => ({
              companyId,
              transactionId: str(r.values.transactionId),
              txDate: str(r.values.txDate),
              productId: prod(r),
              batch: str(r.values.batch),
              warehouse: str(r.values.warehouse),
              txType: str(r.values.txType) as (typeof stockTransactions.$inferInsert)["txType"],
              quantity: str(r.values.quantity),
              importBatchId: batchId,
            })),
          )
          .onConflictDoUpdate({
            target: [stockTransactions.companyId, stockTransactions.transactionId],
            set: {
              txDate: ex(stockTransactions.txDate),
              productId: ex(stockTransactions.productId),
              batch: ex(stockTransactions.batch),
              warehouse: ex(stockTransactions.warehouse),
              txType: ex(stockTransactions.txType),
              quantity: ex(stockTransactions.quantity),
              importBatchId: ex(stockTransactions.importBatchId),
            },
          })
          .then(() => undefined),
      );
      return;

    case "tender_results": {
      // Tenders: one per authority and number. The date is the latest any row of that tender gives.
      const tenderRows = new Map<string, { authority: string; tenderNo: string; title: string | null; awardDate: string }>();
      for (const r of rows) {
        const key = `${str(r.values.authority)}\u0000${str(r.values.tenderNo)}`;
        const prev = tenderRows.get(key);
        tenderRows.set(key, {
          authority: str(r.values.authority),
          tenderNo: str(r.values.tenderNo),
          title: strOrNull(r.values.tenderTitle) ?? prev?.title ?? null,
          awardDate: prev && prev.awardDate > str(r.values.awardDate) ? prev.awardDate : str(r.values.awardDate),
        });
      }
      // A tender we also follow in the Tenders section is linked to it, so its history can be reached from there.
      const live = await tx.select({ id: tenders.id, authority: tenders.authority, tenderNo: tenders.tenderNo }).from(tenders).where(eq(tenders.companyId, companyId));
      const liveId = new Map(live.filter((t) => t.tenderNo).map((t) => [`${t.authority}\u0000${t.tenderNo}`, t.id]));
      const archiveIds = new Map<string, string>();
      await inChunks([...tenderRows.entries()], async (chunk) => {
        const out = await tx
          .insert(tenderArchive)
          .values(
            chunk.map(([key, t]) => ({
              companyId,
              authority: t.authority as (typeof tenderArchive.$inferInsert)["authority"],
              tenderNo: t.tenderNo,
              title: t.title,
              awardDate: t.awardDate,
              tenderId: liveId.get(key) ?? null,
              importBatchId: batchId,
            })),
          )
          .onConflictDoUpdate({
            target: [tenderArchive.companyId, tenderArchive.authority, tenderArchive.tenderNo],
            set: {
              title: sql`coalesce(excluded."title", ${tenderArchive.title})`,
              awardDate: ex(tenderArchive.awardDate),
              tenderId: sql`coalesce(excluded."tender_id", ${tenderArchive.tenderId})`,
              importBatchId: ex(tenderArchive.importBatchId),
            },
          })
          .returning({ id: tenderArchive.id, authority: tenderArchive.authority, tenderNo: tenderArchive.tenderNo });
        for (const o of out) archiveIds.set(`${o.authority}\u0000${o.tenderNo}`, o.id);
      });

      // Items: a product match fills in the therapeutic area when the file did not say.
      const productArea = new Map<string, string | null>();
      const matchedIds = [...new Set(rows.map((r) => (r.values.itemCode == null ? undefined : res.productIds.get(str(r.values.itemCode)))).filter((x): x is string => !!x))];
      for (let i = 0; i < matchedIds.length; i += 1000) {
        for (const p of await tx.select({ id: products.id, area: products.therapeuticArea }).from(products).where(and(eq(products.companyId, companyId), inArray(products.id, matchedIds.slice(i, i + 1000))))) {
          productArea.set(p.id, p.area);
        }
      }
      const lineValues = new Map<string, typeof tenderArchiveLines.$inferInsert>();
      for (const r of rows) {
        const archiveId = archiveIds.get(`${str(r.values.authority)}\u0000${str(r.values.tenderNo)}`)!;
        const lineRef = str(r.values.lineRef);
        const productId = r.values.itemCode == null ? null : (res.productIds.get(str(r.values.itemCode)) ?? null);
        const prev = lineValues.get(`${archiveId}\u0000${lineRef}`);
        lineValues.set(`${archiveId}\u0000${lineRef}`, {
          companyId,
          archiveId,
          lineRef,
          itemCode: strOrNull(r.values.itemCode) ?? prev?.itemCode ?? null,
          itemName: str(r.values.itemName),
          productId: productId ?? prev?.productId ?? null,
          therapeuticArea: strOrNull(r.values.therapeuticArea) ?? (productId ? (productArea.get(productId) ?? null) : null) ?? prev?.therapeuticArea ?? null,
          quantity: strOrNull(r.values.quantity) ?? prev?.quantity ?? null,
          unit: strOrNull(r.values.unit) ?? prev?.unit ?? null,
          importBatchId: batchId,
        });
      }
      const lineIds = new Map<string, string>();
      await inChunks([...lineValues.values()], async (chunk) => {
        const out = await tx
          .insert(tenderArchiveLines)
          .values(chunk)
          .onConflictDoUpdate({
            target: [tenderArchiveLines.companyId, tenderArchiveLines.archiveId, tenderArchiveLines.lineRef],
            // A file that leaves a column empty must not erase what an earlier file knew.
            set: {
              itemName: ex(tenderArchiveLines.itemName),
              itemCode: sql`coalesce(excluded."item_code", ${tenderArchiveLines.itemCode})`,
              productId: sql`coalesce(excluded."product_id", ${tenderArchiveLines.productId})`,
              therapeuticArea: sql`coalesce(excluded."therapeutic_area", ${tenderArchiveLines.therapeuticArea})`,
              quantity: sql`coalesce(excluded."quantity", ${tenderArchiveLines.quantity})`,
              unit: sql`coalesce(excluded."unit", ${tenderArchiveLines.unit})`,
              importBatchId: ex(tenderArchiveLines.importBatchId),
            },
          })
          .returning({ id: tenderArchiveLines.id, archiveId: tenderArchiveLines.archiveId, lineRef: tenderArchiveLines.lineRef });
        for (const o of out) lineIds.set(`${o.archiveId}\u0000${o.lineRef}`, o.id);
      });

      await inChunks(rows, (chunk) =>
        tx
          .insert(tenderBids)
          .values(
            chunk.map((r) => {
              const archiveId = archiveIds.get(`${str(r.values.authority)}\u0000${str(r.values.tenderNo)}`)!;
              return {
                companyId,
                lineId: lineIds.get(`${archiveId}\u0000${str(r.values.lineRef)}`)!,
                bidder: str(r.values.bidder),
                bidderKey: str(r.values.bidder).toLowerCase(),
                isOwn: r.values.ourBid === true,
                unitPrice: strOrNull(r.values.unitPrice),
                currency: str(r.values.currency ?? "JOD"),
                outcome: str(r.values.result ?? "unknown") as (typeof tenderBids.$inferInsert)["outcome"],
                technicalPass: r.values.technicalPass == null ? null : r.values.technicalPass === true,
                awardedQuantity: strOrNull(r.values.awardedQuantity),
                brand: strOrNull(r.values.brand),
                importBatchId: batchId,
              };
            }),
          )
          .onConflictDoUpdate({
            target: [tenderBids.companyId, tenderBids.lineId, tenderBids.bidderKey],
            // Two files can describe the same bid (our own sheet and the award notice): neither may blank what the other knew.
            set: {
              bidder: ex(tenderBids.bidder),
              isOwn: sql`${tenderBids.isOwn} or excluded."is_own"`,
              unitPrice: sql`coalesce(excluded."unit_price", ${tenderBids.unitPrice})`,
              currency: sql`case when excluded."unit_price" is null then ${tenderBids.currency} else excluded."currency" end`,
              outcome: sql`case when excluded."outcome" = 'unknown' then ${tenderBids.outcome} else excluded."outcome" end`,
              technicalPass: sql`coalesce(excluded."technical_pass", ${tenderBids.technicalPass})`,
              awardedQuantity: sql`coalesce(excluded."awarded_quantity", ${tenderBids.awardedQuantity})`,
              brand: sql`coalesce(excluded."brand", ${tenderBids.brand})`,
              importBatchId: ex(tenderBids.importBatchId),
            },
          })
          .then(() => undefined),
      );
      return;
    }

    case "installed_units":
      await inChunks(rows, (chunk) =>
        tx
          .insert(installedUnits)
          .values(
            chunk.map((r) => ({
              companyId,
              code: str(r.values.code),
              customerId: cust(r),
              productId: r.values.productCode == null ? null : prod(r),
              name: str(r.values.name),
              installedOn: strOrNull(r.values.installedOn),
              warrantyEnd: strOrNull(r.values.warrantyEnd),
              service: strOrNull(r.values.service) as (typeof installedUnits.$inferInsert)["service"],
              expectedMonthlyConsumables: strOrNull(r.values.expectedMonthlyConsumables),
              importBatchId: batchId,
            })),
          )
          .onConflictDoUpdate({
            target: [installedUnits.companyId, installedUnits.code],
            set: {
              customerId: ex(installedUnits.customerId),
              productId: ex(installedUnits.productId),
              name: ex(installedUnits.name),
              installedOn: ex(installedUnits.installedOn),
              warrantyEnd: ex(installedUnits.warrantyEnd),
              service: ex(installedUnits.service),
              expectedMonthlyConsumables: ex(installedUnits.expectedMonthlyConsumables),
              importBatchId: ex(installedUnits.importBatchId),
            },
          })
          .then(() => undefined),
      );
      return;
  }
}

export async function runImport(db: Db, input: RunImportInput): Promise<ImportOutcome> {
  const validation = validateImport(input.kind, input.text, { today: input.today, snapshotDate: input.snapshotDate });
  if (validation.fatal !== null) return blank(input, "fatal", validation.fatal);

  const sha = createHash("sha256").update(input.text).digest("hex");

  return db.transaction(async (tx) => {
    const [prior] = await tx
      .select({ id: importBatches.id, status: importBatches.status, createdAt: importBatches.createdAt })
      .from(importBatches)
      .where(and(eq(importBatches.companyId, input.companyId), eq(importBatches.kind, input.kind), eq(importBatches.fileSha256, sha)))
      .limit(1);
    if (prior && prior.status !== "rejected") {
      return blank(input, "already_imported", `This exact file was already imported on ${prior.createdAt.toISOString().slice(0, 10)}. Fix or re-export the file to import it again.`);
    }

    const res = await resolve(tx, input.companyId, input.kind, validation.accepted);
    const rejections = [...validation.rejected, ...res.rejected].sort((a, b) => a.row - b.row);
    const warnings = [...validation.warnings, ...res.warnings].sort((a, b) => a.row - b.row);
    // A snapshot is a complete point-in-time replacement. Never let a valid subset erase the old snapshot,
    // or update invoice headers before discovering that the replacement is incomplete.
    const snapshotBlocked = SPECS[input.kind].snapshot === true && rejections.length > 0;
    if (snapshotBlocked) {
      rejections.push(...res.rows.map((r) => ({ row: r.row, reason: "not loaded: another row failed; snapshots must pass in full" })));
      rejections.sort((a, b) => a.row - b.row);
    }
    const rowsAccepted = snapshotBlocked ? 0 : res.rows.length;
    const rowsRejected = rejections.length;
    const status = rowsAccepted === 0 ? "rejected" : rowsRejected === 0 ? "accepted" : "partial";
    const outcome: ImportOutcome = {
      state: "done",
      message: snapshotBlocked ? "Snapshot blocked: fix all rejected rows and check the complete file again. Nothing was replaced; existing snapshot data and invoice details are unchanged." : null,
      dryRun: input.dryRun,
      wrote: false,
      batchId: null,
      status,
      rowsTotal: validation.rowsTotal,
      rowsAccepted,
      rowsRejected,
      rejections,
      warnings,
      summary: snapshotBlocked ? [] : reconcile(input.kind, res.rows, validation.snapshotDate),
      ignoredColumns: validation.ignoredColumns,
      mappedColumns: validation.mappedColumns,
      snapshotDate: validation.snapshotDate,
    };
    if (input.dryRun) return outcome;

    // An earlier attempt at this exact file was fully rejected and wrote no rows (for example the customer list was
    // missing). Drop its record so this attempt can be recorded under the same file hash.
    if (prior) await tx.delete(importBatches).where(eq(importBatches.id, prior.id));
    const [batch] = await tx
      .insert(importBatches)
      .values({
        companyId: input.companyId,
        kind: input.kind,
        fileName: input.fileName.slice(0, 255),
        fileSha256: sha,
        snapshotDate: validation.snapshotDate,
        rowsTotal: validation.rowsTotal,
        rowsAccepted,
        rowsRejected,
        status,
        rejections: rejections.slice(0, MAX_STORED_REJECTIONS),
        importedBy: input.userId,
      })
      .returning({ id: importBatches.id });
    if (rowsAccepted > 0) await write(tx, input.companyId, batch!.id, input.kind, res.rows, res, validation.snapshotDate);
    return { ...outcome, wrote: rowsAccepted > 0, batchId: batch!.id };
  });
}
