ALTER TYPE "public"."user_role" ADD VALUE 'maintenance';--> statement-breakpoint
ALTER TABLE "installed_units" ADD COLUMN "contract_start" date;--> statement-breakpoint
ALTER TABLE "installed_units" ADD COLUMN "contract_end" date;--> statement-breakpoint
ALTER TABLE "installed_units" ADD COLUMN "contact_name" varchar(200);--> statement-breakpoint
ALTER TABLE "installed_units" ADD COLUMN "contact_phone" varchar(60);--> statement-breakpoint
ALTER TABLE "installed_units" ADD COLUMN "contact_email" varchar(255);