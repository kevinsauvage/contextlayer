ALTER TABLE "analysis" ADD COLUMN "publishing_since" timestamp;--> statement-breakpoint
ALTER TABLE "analysis" ADD COLUMN "run_token" text;--> statement-breakpoint
ALTER TABLE "analysis" ADD COLUMN "started_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
-- Existing rows were created when their run started; the column default would otherwise age them to the migration.
UPDATE "analysis" SET "started_at" = "created_at";