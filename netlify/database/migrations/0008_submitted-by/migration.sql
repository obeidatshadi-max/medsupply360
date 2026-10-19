ALTER TABLE "audit_logs" ADD COLUMN "submitted_by" varchar(80);--> statement-breakpoint
ALTER TABLE "tender_status_log" ADD COLUMN "submitted_by" varchar(80);--> statement-breakpoint
CREATE INDEX "audit_company_created_idx" ON "audit_logs" USING btree ("company_id","created_at");