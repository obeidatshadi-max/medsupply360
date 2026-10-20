CREATE TYPE "public"."action_status" AS ENUM('open', 'done');--> statement-breakpoint
CREATE TABLE "management_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"title" varchar(180) NOT NULL,
	"evidence" text,
	"responsible" varchar(40) NOT NULL,
	"due" date NOT NULL,
	"status" "action_status" DEFAULT 'open' NOT NULL,
	"created_by" varchar(80),
	"completed_on" date,
	"completed_by" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "management_actions_company_id_uniq" UNIQUE("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "management_actions" ADD CONSTRAINT "management_actions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "management_actions_company_status_idx" ON "management_actions" USING btree ("company_id","status","due");