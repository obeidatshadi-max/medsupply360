CREATE TYPE "public"."guarantee_kind" AS ENUM('bid', 'performance');--> statement-breakpoint
CREATE TABLE "tender_guarantees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"tender_id" uuid NOT NULL,
	"kind" "guarantee_kind" NOT NULL,
	"amount" numeric(14, 3) NOT NULL,
	"issued_on" date,
	"expires_on" date NOT NULL,
	"returned_on" date,
	"reference" varchar(80),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tender_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"tender_id" uuid NOT NULL,
	"invoice_no" varchar(80) NOT NULL,
	"invoice_date" date NOT NULL,
	"amount" numeric(14, 3) NOT NULL,
	"collected_amount" numeric(14, 3) DEFAULT '0' NOT NULL,
	"last_collected_on" date,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tender_guarantees" ADD CONSTRAINT "tender_guarantees_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_guarantees" ADD CONSTRAINT "tender_guarantees_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_guarantees" ADD CONSTRAINT "tender_guarantees_company_id_tender_id_tenders_company_id_id_fk" FOREIGN KEY ("company_id","tender_id") REFERENCES "public"."tenders"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_invoices" ADD CONSTRAINT "tender_invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_invoices" ADD CONSTRAINT "tender_invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_invoices" ADD CONSTRAINT "tender_invoices_company_id_tender_id_tenders_company_id_id_fk" FOREIGN KEY ("company_id","tender_id") REFERENCES "public"."tenders"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tender_guarantees_tender_idx" ON "tender_guarantees" USING btree ("company_id","tender_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tender_invoices_no_uniq" ON "tender_invoices" USING btree ("company_id","tender_id","invoice_no");