import "server-only";
import { eq } from "drizzle-orm";
import type { Database } from "@/infrastructure/db/client";
import { decrypt, encrypt } from "@/infrastructure/crypto";
import { jiraConnection } from "@/infrastructure/db/schema";
import { refreshJiraTokens } from "@/integrations/jira/oauth";
import type { JiraConnection } from "@/features/projects/queries";

const EXPIRY_MARGIN_MS = 60_000;

export async function jiraAccessToken(db: Database, connection: JiraConnection): Promise<string> {
  if (connection.expiresAt.getTime() - Date.now() > EXPIRY_MARGIN_MS) return decrypt(connection.accessTokenEnc);

  const tokens = await refreshJiraTokens(decrypt(connection.refreshTokenEnc));
  await db
    .update(jiraConnection)
    .set({
      accessTokenEnc: encrypt(tokens.accessToken),
      refreshTokenEnc: encrypt(tokens.refreshToken),
      expiresAt: tokens.expiresAt,
    })
    .where(eq(jiraConnection.id, connection.id));
  return tokens.accessToken;
}
