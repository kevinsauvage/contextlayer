import { relations } from "drizzle-orm";
import { bigint, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

export const analysisKind = pgEnum("analysis_kind", ["create", "audit"]);
export const analysisStatus = pgEnum("analysis_status", ["running", "completed", "failed"]);

export const githubInstallation = pgTable(
  "github_installation",
  {
    id: bigint("id", { mode: "number" }).primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    accountLogin: text("account_login").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("github_installation_org_idx").on(t.organizationId)],
);

export const jiraConnection = pgTable(
  "jira_connection",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    cloudId: text("cloud_id").notNull(),
    siteUrl: text("site_url").notNull(),
    siteName: text("site_name").notNull(),
    accessTokenEnc: text("access_token_enc").notNull(),
    refreshTokenEnc: text("refresh_token_enc").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    connectedByUserId: text("connected_by_user_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("jira_connection_org_cloud_idx").on(t.organizationId, t.cloudId)],
);

export const project = pgTable(
  "project",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    githubInstallationId: bigint("github_installation_id", { mode: "number" })
      .notNull()
      .references(() => githubInstallation.id),
    repoOwner: text("repo_owner").notNull(),
    repoName: text("repo_name").notNull(),
    jiraConnectionId: uuid("jira_connection_id")
      .notNull()
      .references(() => jiraConnection.id),
    jiraProjectKey: text("jira_project_key").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("project_org_idx").on(t.organizationId)],
);

export const analysis = pgTable(
  "analysis",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id),
    kind: analysisKind("kind").notNull(),
    status: analysisStatus("status").notNull().default("running"),
    input: jsonb("input").notNull(),
    result: jsonb("result"),
    editedResult: jsonb("edited_result"),
    evidenceIssues: jsonb("evidence_issues"),
    model: text("model"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    latencyMs: integer("latency_ms"),
    error: text("error"),
    publishedIssueKey: text("published_issue_key"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("analysis_project_created_idx").on(t.projectId, t.createdAt)],
);

export const projectRelations = relations(project, ({ one, many }) => ({
  jiraConnection: one(jiraConnection, { fields: [project.jiraConnectionId], references: [jiraConnection.id] }),
  analyses: many(analysis),
}));

export const analysisRelations = relations(analysis, ({ one }) => ({
  project: one(project, { fields: [analysis.projectId], references: [project.id] }),
}));
