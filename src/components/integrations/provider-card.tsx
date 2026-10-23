import { ProviderIcon } from "@/components/integrations/provider-icon";
import { DisconnectButton } from "@/components/integrations/disconnect-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { connectHref } from "@/features/integrations/notices";
import type { ProviderOverview } from "@/features/integrations/overview";

type Props = { provider: ProviderOverview; isAdmin: boolean };

function ConnectionStatusBadge({ provider }: { provider: ProviderOverview }) {
  if (!provider.configured) return <Badge variant="outline">Not configured</Badge>;
  if (provider.connections.some((c) => c.status === "needs_reconnect"))
    return <Badge variant="destructive">Needs attention</Badge>;
  if (provider.connections.length) return <Badge variant="secondary">Connected</Badge>;
  return <Badge variant="outline">Not connected</Badge>;
}

export function ProviderCard({ provider, isAdmin }: Props) {
  const { connections } = provider;
  const needsReconnect = connections.some((c) => c.status === "needs_reconnect");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
            <ProviderIcon kind={provider.kind} className="size-4" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <CardTitle className="flex items-center gap-2">
              {provider.name} <ConnectionStatusBadge provider={provider} />
            </CardTitle>
            <CardDescription>{provider.description}</CardDescription>
          </div>
        </div>
      </CardHeader>

      {connections.length > 0 && (
        <CardContent>
          <ul className="flex flex-col divide-y rounded-lg border">
            {connections.map((connection) => (
              <li key={connection.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{connection.label}</span>
                  {connection.metadata.siteUrl && (
                    <span className="truncate text-xs text-muted-foreground">{connection.metadata.siteUrl}</span>
                  )}
                </div>
                {connection.status === "needs_reconnect" && <Badge variant="destructive">Reconnect required</Badge>}
                {isAdmin ? (
                  <DisconnectButton
                    connectionId={connection.id}
                    label={connection.label}
                    providerName={provider.name}
                    projectCount={connection.projectCount}
                  />
                ) : (
                  connection.projectCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {connection.projectCount} project{connection.projectCount > 1 ? "s" : ""}
                    </span>
                  )
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      )}

      <CardFooter className="flex flex-wrap gap-2">
        {!provider.configured ? (
          <p className="text-xs text-muted-foreground">
            Set the {provider.name} credentials on the server to enable it (docs/engineering/integrations-setup.md).
          </p>
        ) : isAdmin ? (
          <>
            <a
              href={connectHref(provider.id)}
              className={buttonVariants({ variant: connections.length && !needsReconnect ? "outline" : "default" })}
            >
              {connections.length ? "Reconnect" : `Connect ${provider.name}`}
            </a>
            {provider.canAddAccount && connections.length > 0 && (
              <a href={connectHref(provider.id, { add: true })} className={buttonVariants({ variant: "ghost" })}>
                Add another {provider.accountNoun}
              </a>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Only organization owners and admins can manage integrations.</p>
        )}
      </CardFooter>
    </Card>
  );
}
