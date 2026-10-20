CREATE TABLE "sales_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"sales_person_id" uuid NOT NULL,
	"customer_id" uuid,
	"visited_on" date NOT NULL,
	"note" varchar(300),
	"recorded_by" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sales_visits" ADD CONSTRAINT "sales_visits_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_visits" ADD CONSTRAINT "sales_visits_company_id_sales_person_id_sales_people_company_id_id_fk" FOREIGN KEY ("company_id","sales_person_id") REFERENCES "public"."sales_people"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_visits_person_day_idx" ON "sales_visits" USING btree ("company_id","sales_person_id","visited_on");