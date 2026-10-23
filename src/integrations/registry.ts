import "server-only";
import type { IntegrationProvider, ProviderKind } from "@/core/integrations/provider";
import { githubProvider } from "./github/provider";
import { jiraProvider } from "./jira/provider";

// Adding a code host or a tracker means implementing SourceProvider or TrackerProvider and listing it here.
const PROVIDERS: IntegrationProvider[] = [githubProvider, jiraProvider];

export const listProviders = (kind?: ProviderKind) =>
  kind ? PROVIDERS.filter((provider) => provider.kind === kind) : PROVIDERS;

export const findProvider = (id: string): IntegrationProvider | undefined =>
  PROVIDERS.find((provider) => provider.id === id);
