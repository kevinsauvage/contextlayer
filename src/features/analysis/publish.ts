import "server-only";
import { eq } from "drizzle-orm";
import type { PublishedIssue } from "@/core/context/source";
import type { TicketDraft } from "@/core/requirements/schemas";
import { toActionError } from "@/features/errors";
import type { Database } from "@/infrastructure/db/client";
import { analysis } from "@/infrastructure/db/schema";

export type PublishResult = { error?: string; issueKey?: string; issueUrl?: string };

// Runs a tracker write the user approved and records where it landed, so the analysis cannot publish twice.
export async function publishApproved(
  db: Database,
  analysisId: string,
  draft: TicketDraft,
  write: () => Promise<PublishedIssue>,
): Promise<PublishResult> {
  try {
    const published = await write();
    await db
      .update(analysis)
      .set({ publishedIssueKey: published.key, publishedIssueUrl: published.url, editedResult: draft })
      .where(eq(analysis.id, analysisId));
    return { issueKey: published.key, issueUrl: published.url };
  } catch (error) {
    const known = toActionError(error);
    if (known) return known;
    console.error("[analysis] publishing failed", error);
    return { error: "The issue tracker rejected the change. Check the project still exists and try again." };
  }
}
