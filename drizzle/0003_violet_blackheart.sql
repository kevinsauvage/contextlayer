CREATE TABLE "analysis_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "analysis_creator_created_idx";--> statement-breakpoint
DROP INDEX "analysis_created_idx";--> statement-breakpoint
ALTER TABLE "analysis_run" ADD CONSTRAINT "analysis_run_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analysis_run_user_started_idx" ON "analysis_run" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "analysis_run_started_idx" ON "analysis_run" USING btree ("started_at");--> statement-breakpoint
INSERT INTO "analysis_run" ("user_id", "started_at") SELECT "created_by_user_id", "created_at" FROM "analysis" WHERE "created_at" > now() - interval '1 day';
