CREATE TABLE "tender_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"tender_id" uuid NOT NULL,
	"delivered_on" date NOT NULL,
	"value" numeric(14, 3),
	"note" varchar(500),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tender_deliveries" ADD CONSTRAINT "tender_deliveries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_deliveries" ADD CONSTRAINT "tender_deliveries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_deliveries" ADD CONSTRAINT "tender_deliveries_company_id_tender_id_tenders_company_id_id_fk" FOREIGN KEY ("company_id","tender_id") REFERENCES "public"."tenders"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tender_deliveries_tender_idx" ON "tender_deliveries" USING btree ("company_id","tender_id","delivered_on");