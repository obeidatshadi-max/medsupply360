CREATE TYPE "public"."deal_cost_line" AS ENUM('discount', 'acquisition', 'freight_customs', 'installation', 'warranty', 'commission', 'financing', 'other');--> statement-breakpoint
CREATE TYPE "public"."deal_entry_status" AS ENUM('actual', 'estimated', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."deal_kind" AS ENUM('tender', 'private');--> statement-breakpoint
CREATE TYPE "public"."deal_match_confidence" AS ENUM('exact', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."deal_outcome_verdict" AS ENUM('pending', 'resolved', 'improved', 'no_change', 'worsened');--> statement-breakpoint
CREATE TYPE "public"."deal_rebate_status" AS ENUM('contractual', 'earned', 'accrued', 'received');--> statement-breakpoint
CREATE TYPE "public"."deal_review_status" AS ENUM('confirmed', 'pending', 'rejected');--> statement-breakpoint
CREATE TABLE "deal_action_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"finding_key" varchar(200) NOT NULL,
	"action_id" uuid,
	"taken_on" date NOT NULL,
	"baseline_margin_pct" numeric(6, 1),
	"baseline_impact_jod" numeric(14, 3) NOT NULL,
	"baseline_contribution_jod" numeric(14, 3) NOT NULL,
	"verdict" "deal_outcome_verdict" DEFAULT 'pending' NOT NULL,
	"checked_on" date,
	"profit_recovered_jod" numeric(14, 3),
	"explanation" text,
	"created_by" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_cost_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"line" "deal_cost_line" NOT NULL,
	"amount" numeric(16, 3) NOT NULL,
	"currency" varchar(3) DEFAULT 'JOD' NOT NULL,
	"fx_rate" numeric(14, 6),
	"vat_included" boolean DEFAULT false NOT NULL,
	"vat_rate" numeric(5, 4) DEFAULT '0.16' NOT NULL,
	"status" "deal_entry_status" DEFAULT 'actual' NOT NULL,
	"provision" boolean DEFAULT false NOT NULL,
	"source_system" varchar(40),
	"source_doc_type" varchar(40),
	"source_doc_no" varchar(80),
	"source_line_no" varchar(40),
	"source_key" varchar(160),
	"confidence" "deal_match_confidence" DEFAULT 'exact' NOT NULL,
	"review" "deal_review_status" DEFAULT 'confirmed' NOT NULL,
	"reviewed_by" varchar(80),
	"covered_by" "deal_cost_line",
	"customer_ref" varchar(80),
	"incurred_on" date,
	"note" text,
	"import_batch_id" uuid,
	"created_by" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_rebates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"supplier" varchar(200) NOT NULL,
	"amount" numeric(16, 3) NOT NULL,
	"currency" varchar(3) DEFAULT 'JOD' NOT NULL,
	"fx_rate" numeric(14, 6),
	"status" "deal_rebate_status" NOT NULL,
	"evidence_ref" varchar(120),
	"credit_note_ref" varchar(120),
	"review" "deal_review_status" DEFAULT 'confirmed' NOT NULL,
	"created_by" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"kind" "deal_kind" NOT NULL,
	"ref" varchar(80) NOT NULL,
	"title" varchar(300) NOT NULL,
	"customer_name" varchar(200) NOT NULL,
	"customer_ref" varchar(80),
	"tender_id" uuid,
	"contract_price" numeric(14, 3) NOT NULL,
	"quote" jsonb NOT NULL,
	"obligations" jsonb NOT NULL,
	"warranty_months" integer DEFAULT 0 NOT NULL,
	"has_installation" boolean DEFAULT false NOT NULL,
	"collection_days_late" integer DEFAULT 0 NOT NULL,
	"identifiers" jsonb NOT NULL,
	"window_start" date,
	"window_end" date,
	"created_by" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deals_company_id_uniq" UNIQUE("company_id","id")
);
--> statement-breakpoint
CREATE TABLE "margin_policies" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"min_contribution_margin_pct" numeric(5, 2),
	"max_discount_pct" numeric(5, 2),
	"cost_overrun_tolerance_pct" numeric(5, 2),
	"deterioration_pp" numeric(5, 2),
	"financing_rate_annual_pct" numeric(5, 2),
	"rounding_tolerance_fils" integer DEFAULT 1 NOT NULL,
	"updated_by" varchar(80),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deal_action_outcomes" ADD CONSTRAINT "deal_action_outcomes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_action_outcomes" ADD CONSTRAINT "deal_action_outcomes_company_id_deal_id_deals_company_id_id_fk" FOREIGN KEY ("company_id","deal_id") REFERENCES "public"."deals"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_action_outcomes" ADD CONSTRAINT "deal_action_outcomes_company_id_action_id_management_actions_company_id_id_fk" FOREIGN KEY ("company_id","action_id") REFERENCES "public"."management_actions"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_cost_entries" ADD CONSTRAINT "deal_cost_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_cost_entries" ADD CONSTRAINT "deal_cost_entries_company_id_deal_id_deals_company_id_id_fk" FOREIGN KEY ("company_id","deal_id") REFERENCES "public"."deals"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_cost_entries" ADD CONSTRAINT "deal_cost_entries_company_id_import_batch_id_import_batches_company_id_id_fk" FOREIGN KEY ("company_id","import_batch_id") REFERENCES "public"."import_batches"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_rebates" ADD CONSTRAINT "deal_rebates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_rebates" ADD CONSTRAINT "deal_rebates_company_id_deal_id_deals_company_id_id_fk" FOREIGN KEY ("company_id","deal_id") REFERENCES "public"."deals"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_company_id_tender_id_tenders_company_id_id_fk" FOREIGN KEY ("company_id","tender_id") REFERENCES "public"."tenders"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "margin_policies" ADD CONSTRAINT "margin_policies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deal_action_outcomes_key_uniq" ON "deal_action_outcomes" USING btree ("company_id","deal_id","finding_key");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_cost_entries_source_uniq" ON "deal_cost_entries" USING btree ("company_id","source_key");--> statement-breakpoint
CREATE INDEX "deal_cost_entries_deal_idx" ON "deal_cost_entries" USING btree ("company_id","deal_id");--> statement-breakpoint
CREATE INDEX "deal_rebates_deal_idx" ON "deal_rebates" USING btree ("company_id","deal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deals_company_ref_uniq" ON "deals" USING btree ("company_id","ref");