import { eq } from "drizzle-orm";
import {
  InvalidGrantError,
  ReconnectRequiredError,
  type ConnectionContext,
  type IntegrationProvider,
} from "@/core/integrations/provider";
import { decrypt, encrypt } from "@/infrastructure/crypto";
import type { Database } from "@/infrastructure/db/client";
import { integrationConnection } from "@/infrastructure/db/schema";
import type { Connection } from "./connections";

const EXPIRY_MARGIN_MS = 60_000;

type Token = { value: string; expiresAt: Date | null };

const isFresh = (expiresAt: Date | null) => !expiresAt || expiresAt.getTime() - Date.now() > EXPIRY_MARGIN_MS;

// Rotating refresh tokens are single use: concurrent refreshes would invalidate each other, so the grant's rows are
// locked and the token is re-read after the lock in case another request already refreshed it.
async function refreshGrant(db: Database, connection: Connection, provider: IntegrationProvider): Promise<Token> {
  const { refresh } = provider;
  if (!refresh) throw new ReconnectRequiredError(connection.label);
  const scope = connection.grantId
    ? eq(integrationConnection.grantId, connection.grantId)
    : eq(integrationConnection.id, connection.id);

  const outcome = await db.transaction(async (tx) => {
    const rows = await tx.select().from(integrationConnection).where(scope).for("update");
    const locked = rows.find((row) => row.id === connection.id);
    if (!locked?.accessTokenEnc || !locked.refreshTokenEnc || locked.status === "needs_reconnect") return null;
    if (isFresh(locked.tokenExpiresAt))
      return { value: decrypt(locked.accessTokenEnc), expiresAt: locked.tokenExpiresAt };

    try {
      const tokens = await refresh(decrypt(locked.refreshTokenEnc));
      await tx
        .update(integrationConnection)
        .set({
          accessTokenEnc: encrypt(tokens.accessToken),
          refreshTokenEnc: encrypt(tokens.refreshToken),
          tokenExpiresAt: tokens.expiresAt,
          updatedAt: new Date(),
        })
        .where(scope);
      return { value: tokens.accessToken, expiresAt: tokens.expiresAt };
    } catch (error) {
      if (!(error instanceof InvalidGrantError)) throw error;
      await tx.update(integrationConnection).set({ status: "needs_reconnect", updatedAt: new Date() }).where(scope);
      return null;
    }
  });
  if (!outcome) throw new ReconnectRequiredError(connection.label);
  return outcome;
}

export function connectionContext(
  db: Database,
  connection: Connection,
  provider: IntegrationProvider,
): ConnectionContext {
  let current: Token | null = connection.accessTokenEnc
    ? { value: decrypt(connection.accessTokenEnc), expiresAt: connection.tokenExpiresAt }
    : null;
  let rejected = false;

  return {
    externalId: connection.externalId,
    label: connection.label,
    metadata: connection.metadata,
    accessToken: async () => {
      if (rejected || connection.status === "needs_reconnect") throw new ReconnectRequiredError(connection.label);
      if (!current) throw new Error(`${provider.name} connections do not use access tokens`);
      if (!isFresh(current.expiresAt)) current = await refreshGrant(db, connection, provider);
      return current.value;
    },
    markReconnect: async () => {
      rejected = true;
      const scope = connection.grantId
        ? eq(integrationConnection.grantId, connection.grantId)
        : eq(integrationConnection.id, connection.id);
      await db.update(integrationConnection).set({ status: "needs_reconnect", updatedAt: new Date() }).where(scope);
    },
  };
}
