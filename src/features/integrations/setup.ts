import type { ProviderKind } from "@/core/integrations/provider";
import { connectHref } from "./notices";
import type { ProviderOverview } from "./overview";

export type SetupStep = { done: boolean; title: string; description: string; href: string; cta: string };

const INTEGRATIONS = "/settings/integrations";
const NEW_PROJECT = "/projects/new";

const COPY: Record<ProviderKind, { title: string; description: (names: string) => string }> = {
  source: {
    title: "Connect your code",
    description: (names) => `Give read-only access to repositories on ${names}.`,
  },
  tracker: {
    title: "Connect your tickets",
    description: (names) => `Link ${names} so drafts can be published after approval.`,
  },
};

const KINDS = ["source", "tracker"] as const;

// The first-run path, in order. Each connect step starts the provider's consent directly and comes back to the step
// that follows it, so nobody has to find their way back from the integrations page.
export function setupSteps(overview: ProviderOverview[], stayOn: string): SetupStep[] {
  const connected = (kind: ProviderKind) =>
    overview.some((provider) => provider.kind === kind && provider.connections.length > 0);

  const connectSteps = KINDS.map((kind) => {
    const providers = overview.filter((provider) => provider.kind === kind);
    const configured = providers.filter((provider) => provider.configured);
    const [only] = configured;
    const lastOpenStep = KINDS.every((other) => other === kind || connected(other));
    return {
      done: connected(kind),
      title: COPY[kind].title,
      description: COPY[kind].description(providers.map((provider) => provider.name).join(" or ")),
      // With several providers to choose from, or none configured, the integrations page is where the choice is made.
      href:
        only && configured.length === 1
          ? connectHref(only.id, { returnTo: lastOpenStep ? NEW_PROJECT : stayOn })
          : INTEGRATIONS,
      cta: "Connect",
    };
  });

  return [
    ...connectSteps,
    {
      done: false,
      title: "Create a project",
      description: "Pick one repository and one ticket project.",
      href: NEW_PROJECT,
      cta: "Create",
    },
  ];
}
