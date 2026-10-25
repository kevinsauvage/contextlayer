import "server-only";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { PUBLISH_CLAIM_MS } from "@/core/analysis/stale";
import type { PublishedIssue } from "@/core/context/source";
import type { TicketDraft } from "@/core/requirements/schemas";
import { toActionError } from "@/features/errors";
import type { Database } from "@/infrastructure/db/client";
import { analysis } from "@/infrastructure/db/schema";

export type PublishResult = { error?: string; issueKey?: string; issueUrl?: string };

// Runs a tracker write the user approved and records where it landed, so the analysis cannot publish twice.
// The row is claimed first: a second tab or a quick retry finds the live claim and stops before creating a duplicate,
// and a claim left by a request that died expires instead of blocking the analysis forever.
export async function publishApproved(
  db: Database,
  analysisId: string,
  draft: TicketDraft,
  write: () => Promise<PublishedIssue>,
): Promise<PublishResult> {
  const [claimed] = await db
    .update(analysis)
    .set({ publishingSince: new Date() })
    .where(
      and(
        eq(analysis.id, analysisId),
        isNull(analysis.publishedIssueKey),
        or(isNull(analysis.publishingSince), lt(analysis.publishingSince, new Date(Date.now() - PUBLISH_CLAIM_MS))),
      ),
    )
    .returning({ id: analysis.id });
  if (!claimed) return { error: "This analysis is already being published" };

  let published: PublishedIssue;
  try {
    published = await write();
  } catch (error) {
    const known = toActionError(error);
    // A known error is a refusal, so nothing was written and the claim can go. Anything else (a timeout, a dropped
    // response) may have created the issue, so the claim stays until it expires and an instant retry cannot duplicate it.
    if (known) {
      await db.update(analysis).set({ publishingSince: null }).where(eq(analysis.id, analysisId));
      return known;
    }
    console.error("[analysis] publishing failed", error);
    return {
      error:
        "The issue tracker did not confirm the change. Check it for the change before approving again in a few minutes.",
    };
  }
  return recordPublished(db, analysisId, draft, published);
}

const RECORD_ATTEMPTS = 2;

// The claim only lasts PUBLISH_CLAIM_MS, so an unrecorded publish is retried once and otherwise reported plainly.
async function recordPublished(
  db: Database,
  analysisId: string,
  draft: TicketDraft,
  published: PublishedIssue,
): Promise<PublishResult> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await db
        .update(analysis)
        .set({
          publishedIssueKey: published.key,
          publishedIssueUrl: published.url,
          editedResult: draft,
          publishingSince: null,
        })
        .where(eq(analysis.id, analysisId));
      return { issueKey: published.key, issueUrl: published.url };
    } catch (error) {
      if (attempt < RECORD_ATTEMPTS) continue;
      console.error("[analysis] published but could not record it", error);
      return {
        issueKey: published.key,
        issueUrl: published.url,
        error: `Published as ${published.key}, but the app could not record it and may offer to publish again. Do not approve this draft again; use ${published.key}.`,
      };
    }
  }
}
