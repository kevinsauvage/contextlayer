import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ConnectNotice } from "@/components/integrations/connect-notice";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import type { ProviderKind } from "@/core/integrations/provider";
import { ProviderCard } from "@/components/integrations/provider-card";
import { integrationsOverview, ofKind, providerNames } from "@/features/integrations/overview";
import { listProjects } from "@/features/projects/queries";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";

export const metadata: Metadata = { title: "Integrations" };

const SECTIONS = [
  { kind: "source", title: "Code sources", description: "Where ContextLayer reads code to find evidence." },
  { kind: "tracker", title: "Issue trackers", description: "Where tickets are read, created and updated." },
] as const;

export default async function Page({ searchParams }: PageProps<"/settings/integrations">) {
  const { organizationId, isAdmin } = await requireOrgContext();
  const db = getDb();
  const [overview, projects, params] = await Promise.all([
    integrationsOverview(db, organizationId),
    listProjects(db, organizationId),
    searchParams,
  ]);

  // Until the first project exists this page is part of setup: it points at the next step once both sides are
  // connected, and the connection that completes the pair returns straight to the new project form.
  const settingUp = isAdmin && projects.length === 0;
  const connected = (kind: ProviderKind) => ofKind(overview, kind).some((provider) => provider.connections.length > 0);
  const ready = SECTIONS.every((section) => connected(section.kind));
  const completesSetup = (kind: ProviderKind) =>
    settingUp && !connected(kind) && SECTIONS.every((section) => section.kind === kind || connected(section.kind));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Integrations"
        description="Connect where your code lives and where your tickets live. Code is only read; tickets are written only after you approve a draft."
      />
      <ConnectNotice params={params} providerNames={providerNames(overview)} />
      {settingUp && ready && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand/6 px-4 py-3 ring-1 ring-brand/15"
        >
          <div className="flex flex-col">
            <span className="font-medium">Your code and tickets are connected</span>
            <span className="text-sm text-muted-foreground">Next, pair a repository with a ticket project.</span>
          </div>
          <Link href="/projects/new" className={buttonVariants()}>
            Create a project <ArrowRight />
          </Link>
        </div>
      )}
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
              <ProviderCard
                key={provider.id}
                provider={provider}
                isAdmin={isAdmin}
                returnTo={completesSetup(section.kind) ? "/projects/new" : undefined}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
