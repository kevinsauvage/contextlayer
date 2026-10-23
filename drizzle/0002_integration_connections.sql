CREATE TYPE "public"."connection_status" AS ENUM('active', 'needs_reconnect');--> statement-breakpoint
CREATE TABLE "integration_connection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"label" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "connection_status" DEFAULT 'active' NOT NULL,
	"access_token_enc" text,
	"refresh_token_enc" text,
	"token_expires_at" timestamp,
	"connected_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "source_connection_id" uuid;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "source_resource_id" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "source_resource_label" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "tracker_connection_id" uuid;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "tracker_resource_id" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "tracker_resource_label" text;--> statement-breakpoint
ALTER TABLE "integration_connection" ADD CONSTRAINT "integration_connection_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connection" ADD CONSTRAINT "integration_connection_connected_by_user_id_user_id_fk" FOREIGN KEY ("connected_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "integration_connection_org_provider_external_idx" ON "integration_connection" USING btree ("organization_id","provider","external_id");--> statement-breakpoint
CREATE INDEX "integration_connection_org_idx" ON "integration_connection" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_source_connection_id_integration_connection_id_fk" FOREIGN KEY ("source_connection_id") REFERENCES "public"."integration_connection"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_tracker_connection_id_integration_connection_id_fk" FOREIGN KEY ("tracker_connection_id") REFERENCES "public"."integration_connection"("id") ON DELETE no action ON UPDATE no action;