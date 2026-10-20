CREATE TYPE "public"."indicator_direction" AS ENUM('at_least', 'at_most');--> statement-breakpoint
CREATE TABLE "support_indicators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"department" varchar(40) NOT NULL,
	"name" varchar(120) NOT NULL,
	"unit" varchar(20) DEFAULT '' NOT NULL,
	"direction" "indicator_direction" NOT NULL,
	"target" numeric(14, 3) NOT NULL,
	"actual" numeric(14, 3),
	"measured_on" date,
	"reading_by" varchar(80),
	"responsible" varchar(80),
	"consequence" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_indicators_company_id_uniq" UNIQUE("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "support_indicators" ADD CONSTRAINT "support_indicators_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "support_indicators_name_uniq" ON "support_indicators" USING btree ("company_id","department",lower("name"));--> statement-breakpoint
CREATE INDEX "support_indicators_company_idx" ON "support_indicators" USING btree ("company_id","department");