"use client";

import { ConfirmButton } from "@/components/confirm-button";
import { disconnectConnection } from "@/features/integrations/actions";
import { countLabel } from "@/lib/count";

type Props = { connectionId: string; label: string; providerName: string; projectCount: number };

export function DisconnectButton({ connectionId, label, providerName, projectCount }: Props) {
  if (projectCount > 0) {
    return (
      <span className="text-xs text-muted-foreground">Used by {countLabel(projectCount, "project", "projects")}</span>
    );
  }

  return (
    <ConfirmButton
      trigger="Disconnect"
      triggerVariant="ghost"
      triggerSize="sm"
      title={`Disconnect ${label}?`}
      description={`ContextLayer forgets this ${providerName} connection and its stored credentials. You can connect it again later.`}
      confirmLabel="Disconnect"
      pendingLabel="Disconnecting…"
      success={`${label} disconnected from ContextLayer.`}
      action={() => disconnectConnection(connectionId)}
    />
  );
}
