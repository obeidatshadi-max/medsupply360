CREATE TABLE "sales_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"email" varchar(255),
	"supplier_names" text[] DEFAULT '{}'::text[] NOT NULL,
	"monthly_sales_target" numeric(14, 3),
	"new_accounts_target" integer,
	"visits_per_week" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_people_company_id_uniq" UNIQUE("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "sales_person_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sales_person_id" uuid;--> statement-breakpoint
ALTER TABLE "tenders" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "sales_people" ADD CONSTRAINT "sales_people_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sales_people_name_uniq" ON "sales_people" USING btree ("company_id",lower("name"));--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_sales_person_id_sales_people_company_id_id_fk" FOREIGN KEY ("company_id","sales_person_id") REFERENCES "public"."sales_people"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_sales_person_id_sales_people_company_id_id_fk" FOREIGN KEY ("company_id","sales_person_id") REFERENCES "public"."sales_people"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_company_id_owner_id_sales_people_company_id_id_fk" FOREIGN KEY ("company_id","owner_id") REFERENCES "public"."sales_people"("company_id","id") ON DELETE no action ON UPDATE no action;