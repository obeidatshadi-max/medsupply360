CREATE TABLE "tender_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"tender_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"item_name" varchar(300) NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit" varchar(30),
	"estimated_unit_price" numeric(14, 3),
	"our_unit_price" numeric(14, 3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tender_items" ADD CONSTRAINT "tender_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_items" ADD CONSTRAINT "tender_items_company_id_tender_id_tenders_company_id_id_fk" FOREIGN KEY ("company_id","tender_id") REFERENCES "public"."tenders"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tender_items_line_uniq" ON "tender_items" USING btree ("tender_id","line_no");