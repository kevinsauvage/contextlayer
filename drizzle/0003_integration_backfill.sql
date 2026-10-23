ALTER TABLE "integration_connection" ADD COLUMN "grant_id" uuid;--> statement-breakpoint
ALTER TABLE "analysis" ADD COLUMN "published_issue_url" text;--> statement-breakpoint
INSERT INTO "integration_connection" ("organization_id", "provider", "external_id", "label", "connected_by_user_id", "created_at", "updated_at")
SELECT gi."organization_id", 'github', gi."id"::text, gi."account_login",
  COALESCE(
    (SELECT m."user_id" FROM "member" m WHERE m."organization_id" = gi."organization_id" ORDER BY m."created_at" LIMIT 1),
    (SELECT u."id" FROM "user" u ORDER BY u."created_at" LIMIT 1)
  ),
  gi."created_at", gi."created_at"
FROM "github_installation" gi
WHERE EXISTS (SELECT 1 FROM "user");--> statement-breakpoint
-- One Atlassian consent stored the same encrypted tokens on every site it returned, so they share a grant.
INSERT INTO "integration_connection" ("id", "organization_id", "provider", "external_id", "label", "metadata", "access_token_enc", "refresh_token_enc", "grant_id", "token_expires_at", "connected_by_user_id", "created_at", "updated_at")
SELECT jc."id", jc."organization_id", 'jira', jc."cloud_id", jc."site_name", jsonb_build_object('siteUrl', jc."site_url"),
  jc."access_token_enc", jc."refresh_token_enc", md5(jc."refresh_token_enc")::uuid, jc."expires_at", jc."connected_by_user_id", jc."created_at", jc."created_at"
FROM "jira_connection" jc;--> statement-breakpoint
UPDATE "project" p SET
  "source_connection_id" = ic."id",
  "source_resource_id" = p."repo_owner" || '/' || p."repo_name",
  "source_resource_label" = p."repo_owner" || '/' || p."repo_name",
  "tracker_connection_id" = p."jira_connection_id",
  "tracker_resource_id" = p."jira_project_key",
  "tracker_resource_label" = p."jira_project_key"
FROM "integration_connection" ic
WHERE ic."organization_id" = p."organization_id" AND ic."provider" = 'github' AND ic."external_id" = p."github_installation_id"::text;--> statement-breakpoint
UPDATE "analysis" a SET "published_issue_url" = (jc."site_url" || '/browse/' || a."published_issue_key")
FROM "project" p, "jira_connection" jc
WHERE a."project_id" = p."id" AND p."jira_connection_id" = jc."id" AND a."published_issue_key" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "project" DROP CONSTRAINT "project_github_installation_id_github_installation_id_fk";--> statement-breakpoint
ALTER TABLE "project" DROP CONSTRAINT "project_jira_connection_id_jira_connection_id_fk";--> statement-breakpoint
DROP TABLE "github_installation" CASCADE;--> statement-breakpoint
DROP TABLE "jira_connection" CASCADE;--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "source_connection_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "source_resource_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "source_resource_label" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "tracker_connection_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "tracker_resource_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "tracker_resource_label" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "integration_connection_grant_idx" ON "integration_connection" USING btree ("grant_id");--> statement-breakpoint
CREATE INDEX "project_source_connection_idx" ON "project" USING btree ("source_connection_id");--> statement-breakpoint
CREATE INDEX "project_tracker_connection_idx" ON "project" USING btree ("tracker_connection_id");--> statement-breakpoint
ALTER TABLE "project" DROP COLUMN "github_installation_id";--> statement-breakpoint
ALTER TABLE "project" DROP COLUMN "repo_owner";--> statement-breakpoint
ALTER TABLE "project" DROP COLUMN "repo_name";--> statement-breakpoint
ALTER TABLE "project" DROP COLUMN "jira_connection_id";--> statement-breakpoint
ALTER TABLE "project" DROP COLUMN "jira_project_key";
