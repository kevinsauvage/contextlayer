"use client";

import { Plus } from "lucide-react";
import { useActionState, useState } from "react";
import { FormError } from "@/components/form-error";
import { ProviderIcon } from "@/components/provider-icon";
import { ResourcePicker } from "@/components/resource-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ProviderKind, Resource } from "@/core/integrations/provider";
import { connectHref } from "@/features/integrations/notices";
import type { ProviderOverview } from "@/features/integrations/overview";
import { createProject } from "@/features/projects/actions";

const RETURN_TO = "/projects/new";

type StepProps = {
  step: number;
  kind: ProviderKind;
  title: string;
  description: string;
  providers: ProviderOverview[];
  onResource: (resource: Resource) => void;
};

function ConnectLinks({ providers }: { providers: ProviderOverview[] }) {
  const links = providers
    .filter((provider) => provider.configured && (provider.canAddAccount || !provider.connections.length))
    .map((provider) => {
      const add = provider.connections.length > 0;
      return {
        id: provider.id,
        href: connectHref(provider.id, { add, returnTo: RETURN_TO }),
        label: add ? `Add a ${provider.name} ${provider.accountNoun}` : `Connect ${provider.name}`,
      };
    });
  if (!links.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <a key={link.id} href={link.href} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Plus /> {link.label}
        </a>
      ))}
    </div>
  );
}

function ConnectionStep({ step, kind, title, description, providers, onResource }: StepProps) {
  const options = providers.flatMap((provider) =>
    provider.connections.map((connection) => ({ ...connection, provider })),
  );
  const [connectionId, setConnectionId] = useState(
    (options.find((option) => option.status === "active") ?? options[0])?.id,
  );
  const current = options.find((option) => option.id === connectionId);
  const field = kind === "source" ? "source" : "tracker";

  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4" aria-labelledby={`${field}-step`}>
      <div className="flex items-start gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
          {step}
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 id={`${field}-step`} className="font-medium">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {!current ? (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4 text-sm">
          <p className="text-muted-foreground">
            Nothing connected yet. Connect one to continue; you will come back here.
          </p>
          <ConnectLinks providers={providers} />
          {!providers.some((provider) => provider.configured) && (
            <p className="text-xs text-muted-foreground">No provider is configured on this server yet.</p>
          )}
        </div>
      ) : (
        <>
          {options.length > 1 ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${field}ConnectionId`}>Account</Label>
              <NativeSelect
                id={`${field}ConnectionId`}
                name={`${field}ConnectionId`}
                value={connectionId}
                onChange={(e) => setConnectionId(e.target.value)}
                className="w-full"
              >
                {options.map((option) => (
                  <NativeSelectOption key={option.id} value={option.id}>
                    {option.provider.name} · {option.label}
                    {option.status === "needs_reconnect" ? " (reconnect required)" : ""}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm">
              <ProviderIcon kind={kind} className="size-4 text-muted-foreground" />
              {current.provider.name} · <span className="font-medium">{current.label}</span>
              <input type="hidden" name={`${field}ConnectionId`} value={current.id} />
            </p>
          )}
          <ResourcePicker
            key={current.id}
            connectionId={current.id}
            name={`${field}ResourceId`}
            noun={current.provider.resourceNoun}
            emptyHint={`No ${current.provider.resourceNoun} is visible to this ${current.provider.name} ${current.provider.accountNoun}. Grant access in ${current.provider.name}, then reload.`}
            onSelect={onResource}
          />
          <ConnectLinks providers={providers} />
        </>
      )}
    </section>
  );
}

// The project name follows the chosen repository until the user types their own.
const nameFromResource = (resource: Resource) => resource.label.split("/").at(-1) ?? resource.label;

export function ProjectForm({ sources, trackers }: { sources: ProviderOverview[]; trackers: ProviderOverview[] }) {
  const [state, action, pending] = useActionState(createProject, {});
  const [name, setName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const ready = [sources, trackers].every((providers) => providers.some((p) => p.connections.length > 0));

  return (
    <form action={action} className="flex flex-col gap-4">
      <ConnectionStep
        step={1}
        kind="source"
        title="Code"
        description="The repository ContextLayer reads for evidence."
        providers={sources}
        onResource={(resource) => {
          if (!nameEdited) setName(nameFromResource(resource));
        }}
      />
      <ConnectionStep
        step={2}
        kind="tracker"
        title="Tickets"
        description="Where related issues are searched and approved tickets are written."
        providers={trackers}
        onResource={() => undefined}
      />
      <section className="flex flex-col gap-2 rounded-xl border p-4">
        <Label htmlFor="name">Project name</Label>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={100}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameEdited(true);
          }}
          placeholder="Checkout web app"
        />
      </section>
      {state.error && <FormError error={state.error} />}
      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={pending || !ready}>
          {pending ? "Creating…" : "Create project"}
        </Button>
        {!ready && <p className="text-sm text-muted-foreground">Connect your code and your tickets first.</p>}
      </div>
    </form>
  );
}
