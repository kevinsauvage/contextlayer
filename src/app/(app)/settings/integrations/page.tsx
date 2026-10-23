import type { Metadata } from "next";
import { ConnectNotice } from "@/components/integrations/connect-notice";
import { PageHeader } from "@/components/page-header";
import { ProviderCard } from "@/components/integrations/provider-card";
import { integrationsOverview, ofKind, providerNames } from "@/features/integrations/overview";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";

export const metadata: Metadata = { title: "Integrations" };

const SECTIONS = [
  { kind: "source", title: "Code sources", description: "Where ContextLayer reads code to find evidence." },
  { kind: "tracker", title: "Issue trackers", description: "Where tickets are read, created and updated." },
] as const;

export default async function Page({ searchParams }: PageProps<"/settings/integrations">) {
  const { organizationId, isAdmin } = await requireOrgContext();
  const [overview, params] = await Promise.all([integrationsOverview(getDb(), organizationId), searchParams]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Integrations"
        description="Connect where your code lives and where your tickets live. Code is only read; tickets are written only after you approve a draft."
      />
      <ConnectNotice params={params} providerNames={providerNames(overview)} />
      {SECTIONS.map((section) => (
        <section key={section.kind} className="flex flex-col gap-3" aria-labelledby={`${section.kind}-heading`}>
          <div>
            <h2 id={`${section.kind}-heading`} className="font-medium">
              {section.title}
            </h2>
            <p className="text-sm text-muted-foreground">{section.description}</p>
          </div>
          <div className="grid gap-4">
            {ofKind(overview, section.kind).map((provider) => (
              <ProviderCard key={provider.id} provider={provider} isAdmin={isAdmin} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
