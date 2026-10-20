CREATE TABLE "company_profiles" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"location" varchar(160) DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"founded" varchar(4) DEFAULT '' NOT NULL,
	"team" varchar(160) DEFAULT '' NOT NULL,
	"audience" text DEFAULT '' NOT NULL,
	"purpose" text DEFAULT '' NOT NULL,
	"erp" varchar(160) DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"updated_by" varchar(80),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;