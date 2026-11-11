ALTER TYPE "public"."import_kind" ADD VALUE 'invoice_totals';--> statement-breakpoint
ALTER TABLE "sales_lines" ALTER COLUMN "product_id" DROP NOT NULL;