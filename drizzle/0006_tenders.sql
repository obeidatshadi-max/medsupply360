CREATE TYPE "public"."tender_authority" AS ENUM('MOH', 'KHCC', 'DRMS', 'JUH', 'KAUH');--> statement-breakpoint
CREATE TYPE "public"."tender_line" AS ENUM('equipment', 'consumables', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."tender_status" AS ENUM('pipeline', 'open', 'preparing', 'submitted', 'technical_review', 'financial_review', 'won', 'lost', 'cancelled', 'contracted', 'delivered', 'collected');--> statement-breakpoint
CREATE TABLE "tender_status_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"tender_id" uuid NOT NULL,
	"from_status" "tender_status",
	"to_status" "tender_status" NOT NULL,
	"user_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"authority" "tender_authority" NOT NULL,
	"tender_no" varchar(80),
	"title" varchar(300) NOT NULL,
	"product_line" "tender_line" NOT NULL,
	"status" "tender_status" DEFAULT 'pipeline' NOT NULL,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"estimated_value" numeric(14, 3),
	"deadline" date,
	"bid_value" numeric(14, 3),
	"award_amount" numeric(14, 3),
	"close_reason" text,
	"contract_no" varchar(80),
	"contract_value" numeric(14, 3),
	"delivered_on" date,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenders_company_id_uniq" UNIQUE("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "tender_status_log" ADD CONSTRAINT "tender_status_log_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_status_log" ADD CONSTRAINT "tender_status_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_status_log" ADD CONSTRAINT "tender_status_log_company_id_tender_id_tenders_company_id_id_fk" FOREIGN KEY ("company_id","tender_id") REFERENCES "public"."tenders"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tender_status_log_tender_idx" ON "tender_status_log" USING btree ("tender_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tenders_authority_no_uniq" ON "tenders" USING btree ("company_id","authority","tender_no");--> statement-breakpoint
CREATE INDEX "tenders_status_idx" ON "tenders" USING btree ("company_id","status");