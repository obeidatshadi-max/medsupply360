CREATE TYPE "public"."tender_bid_outcome" AS ENUM('won', 'lost', 'disqualified', 'withdrawn', 'unknown');--> statement-breakpoint
ALTER TYPE "public"."import_kind" ADD VALUE 'tender_results';--> statement-breakpoint
CREATE TABLE "tender_archive" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"authority" "tender_authority" NOT NULL,
	"tender_no" varchar(80) NOT NULL,
	"title" varchar(300),
	"award_date" date NOT NULL,
	"tender_id" uuid,
	"import_batch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tender_archive_company_id_uniq" UNIQUE("company_id","id")
);
--> statement-breakpoint
CREATE TABLE "tender_archive_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"archive_id" uuid NOT NULL,
	"line_ref" varchar(300) NOT NULL,
	"item_code" varchar(80),
	"item_name" varchar(300) NOT NULL,
	"product_id" uuid,
	"therapeutic_area" varchar(100),
	"quantity" numeric(14, 3),
	"unit" varchar(30),
	"import_batch_id" uuid,
	CONSTRAINT "tender_archive_lines_company_id_uniq" UNIQUE("company_id","id")
);
--> statement-breakpoint
CREATE TABLE "tender_bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"line_id" uuid NOT NULL,
	"bidder" varchar(200) NOT NULL,
	"bidder_key" varchar(200) NOT NULL,
	"is_own" boolean DEFAULT false NOT NULL,
	"unit_price" numeric(14, 3),
	"currency" varchar(3) DEFAULT 'JOD' NOT NULL,
	"outcome" "tender_bid_outcome" DEFAULT 'unknown' NOT NULL,
	"technical_pass" boolean,
	"awarded_quantity" numeric(14, 3),
	"brand" varchar(200),
	"import_batch_id" uuid
);
--> statement-breakpoint
ALTER TABLE "tender_archive" ADD CONSTRAINT "tender_archive_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_archive" ADD CONSTRAINT "tender_archive_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_archive" ADD CONSTRAINT "tender_archive_company_id_tender_id_tenders_company_id_id_fk" FOREIGN KEY ("company_id","tender_id") REFERENCES "public"."tenders"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_archive_lines" ADD CONSTRAINT "tender_archive_lines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_archive_lines" ADD CONSTRAINT "tender_archive_lines_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_archive_lines" ADD CONSTRAINT "tender_archive_lines_company_id_archive_id_tender_archive_company_id_id_fk" FOREIGN KEY ("company_id","archive_id") REFERENCES "public"."tender_archive"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_archive_lines" ADD CONSTRAINT "tender_archive_lines_company_id_product_id_products_company_id_id_fk" FOREIGN KEY ("company_id","product_id") REFERENCES "public"."products"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_bids" ADD CONSTRAINT "tender_bids_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_bids" ADD CONSTRAINT "tender_bids_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_bids" ADD CONSTRAINT "tender_bids_company_id_line_id_tender_archive_lines_company_id_id_fk" FOREIGN KEY ("company_id","line_id") REFERENCES "public"."tender_archive_lines"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tender_archive_authority_no_uniq" ON "tender_archive" USING btree ("company_id","authority","tender_no");--> statement-breakpoint
CREATE INDEX "tender_archive_date_idx" ON "tender_archive" USING btree ("company_id","award_date");--> statement-breakpoint
CREATE UNIQUE INDEX "tender_archive_lines_ref_uniq" ON "tender_archive_lines" USING btree ("company_id","archive_id","line_ref");--> statement-breakpoint
CREATE INDEX "tender_archive_lines_product_idx" ON "tender_archive_lines" USING btree ("company_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tender_bids_bidder_uniq" ON "tender_bids" USING btree ("company_id","line_id","bidder_key");--> statement-breakpoint
CREATE INDEX "tender_bids_line_idx" ON "tender_bids" USING btree ("company_id","line_id");