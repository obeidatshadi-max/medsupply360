ALTER TABLE "tender_invoices" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "tenders" ADD COLUMN "payment_terms_days" integer;