CREATE TABLE "import_column_choices" (
	"company_id" uuid NOT NULL,
	"kind" "import_kind" NOT NULL,
	"heading" varchar(255) NOT NULL,
	"field_key" varchar(64) NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_column_choices_company_id_kind_heading_pk" PRIMARY KEY("company_id","kind","heading")
);
--> statement-breakpoint
ALTER TABLE "import_column_choices" ADD CONSTRAINT "import_column_choices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_column_choices" ADD CONSTRAINT "import_column_choices_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;