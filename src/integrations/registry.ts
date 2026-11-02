import "server-only";
import type { IntegrationProvider, ProviderKind } from "@/core/integrations/provider";
import { getEnv } from "@/infrastructure/env";
import { fakeSourceProvider, fakeTrackerProvider } from "./fake/providers";
import { githubProvider } from "./github/provider";
import { jiraProvider } from "./jira/provider";

// Adding a code host or a tracker means implementing SourceProvider or TrackerProvider and listing it here.
const PROVIDERS: IntegrationProvider[] = [githubProvider, jiraProvider];
const FAKE_PROVIDERS: IntegrationProvider[] = [fakeSourceProvider, fakeTrackerProvider];

const providers = () => (getEnv().E2E_FAKE_PROVIDERS ? FAKE_PROVIDERS : PROVIDERS);

export const listProviders = (kind?: ProviderKind) =>
  kind ? providers().filter((provider) => provider.kind === kind) : providers();

export const findProvider = (id: string): IntegrationProvider | undefined =>
  providers().find((provider) => provider.id === id);
