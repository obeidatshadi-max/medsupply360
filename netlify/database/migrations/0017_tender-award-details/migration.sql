ALTER TABLE "tenders" ADD COLUMN "close_reason_code" varchar(30);--> statement-breakpoint
ALTER TABLE "tenders" ADD COLUMN "winner_name" varchar(200);--> statement-breakpoint
ALTER TABLE "tenders" ADD COLUMN "winning_price" numeric(14, 3);--> statement-breakpoint
ALTER TABLE "tenders" ADD COLUMN "expected_award_date" date;