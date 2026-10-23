ALTER TABLE "integration_connection" ADD COLUMN "exclusive_key" text;--> statement-breakpoint
-- Backfill providers that were already exclusive (GitHub App installations) so the unique index covers existing rows.
UPDATE "integration_connection" SET "exclusive_key" = "provider" || ':' || "external_id" WHERE "provider" = 'github';--> statement-breakpoint
CREATE UNIQUE INDEX "integration_connection_exclusive_key_idx" ON "integration_connection" USING btree ("exclusive_key");
