import { relations } from "drizzle-orm";
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { StoredAnalysisInput } from "@/core/analysis/schemas";
import type { EvidenceIssue } from "@/core/evidence/validate";
import type { TicketDraft } from "@/core/requirements/schemas";
import { organization, user } from "./auth";

export const analysisKind = pgEnum("analysis_kind", ["create", "audit"]);
export const analysisStatus = pgEnum("analysis_status", ["running", "completed", "failed"]);
export const connectionStatus = pgEnum("connection_status", ["active", "needs_reconnect"]);

export const integrationConnection = pgTable(
  "integration_connection",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    externalId: text("external_id").notNull(),
    label: text("label").notNull(),
    metadata: jsonb("metadata").$type<Record<string, string>>().notNull().default({}),
    status: connectionStatus("status").notNull().default("active"),
    accessTokenEnc: text("access_token_enc"),
    refreshTokenEnc: text("refresh_token_enc"),
    // Connections created by one OAuth consent share tokens; a refresh rotates them for the whole grant.
    grantId: uuid("grant_id"),
    tokenExpiresAt: timestamp("token_expires_at"),
    connectedByUserId: text("connected_by_user_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    // Set for exclusive providers (`provider:externalId`) so the database, not just a pre-check, keeps them unique.
    exclusiveKey: text("exclusive_key"),
  },
  (t) => [
    uniqueIndex("integration_connection_org_provider_external_idx").on(t.organizationId, t.provider, t.externalId),
    uniqueIndex("integration_connection_exclusive_key_idx").on(t.exclusiveKey),
    index("integration_connection_org_idx").on(t.organizationId),
    index("integration_connection_grant_idx").on(t.grantId),
  ],
);

export const project = pgTable(
  "project",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sourceConnectionId: uuid("source_connection_id")
      .notNull()
      .references(() => integrationConnection.id),
    sourceResourceId: text("source_resource_id").notNull(),
    sourceResourceLabel: text("source_resource_label").notNull(),
    trackerConnectionId: uuid("tracker_connection_id")
      .notNull()
      .references(() => integrationConnection.id),
    trackerResourceId: text("tracker_resource_id").notNull(),
    trackerResourceLabel: text("tracker_resource_label").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("project_org_idx").on(t.organizationId),
    index("project_source_connection_idx").on(t.sourceConnectionId),
    index("project_tracker_connection_idx").on(t.trackerConnectionId),
  ],
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
    input: jsonb("input").$type<StoredAnalysisInput>().notNull(),
    result: jsonb("result"),
    editedResult: jsonb("edited_result").$type<TicketDraft>(),
    evidenceIssues: jsonb("evidence_issues").$type<EvidenceIssue[]>(),
    model: text("model"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    latencyMs: integer("latency_ms"),
    error: text("error"),
    publishedIssueKey: text("published_issue_key"),
    publishedIssueUrl: text("published_issue_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("analysis_project_created_idx").on(t.projectId, t.createdAt)],
);

export const projectRelations = relations(project, ({ many }) => ({
  analyses: many(analysis),
}));

export const analysisRelations = relations(analysis, ({ one }) => ({
  project: one(project, { fields: [analysis.projectId], references: [project.id] }),
}));
