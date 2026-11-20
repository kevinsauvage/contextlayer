// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectNotice } from "@/components/integrations/connect-notice";
import { DisconnectButton } from "@/components/integrations/disconnect-button";
import { ProviderCard } from "@/components/integrations/provider-card";
import { SetupChecklist } from "@/components/integrations/setup-checklist";
import type { ProviderOverview } from "@/features/integrations/overview";
import type { SetupStep } from "@/features/integrations/setup";

const disconnectConnection = vi.hoisted(() => vi.fn());
vi.mock("@/features/integrations/actions", () => ({ disconnectConnection }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/ui/toast", () => ({ notify: vi.fn(), notifyError: vi.fn() }));

afterEach(() => {
  cleanup();
  disconnectConnection.mockReset();
});

const connection = (overrides: Record<string, unknown> = {}) => ({
  id: "c1",
  provider: "github",
  label: "acme",
  status: "active" as const,
  metadata: {},
  createdAt: new Date(),
  projectCount: 0,
  ...overrides,
});

const provider = (overrides: Partial<ProviderOverview> = {}): ProviderOverview => ({
  id: "github",
  name: "GitHub",
  kind: "source",
  description: "Read-only repositories",
  accountNoun: "account",
  resourceNoun: "repository",
  canAddAccount: true,
  exclusive: true,
  supportsSubdirectory: true,
  configured: true,
  connections: [],
  ...overrides,
});

describe("ProviderCard", () => {
  it("says when a provider is not configured", () => {
    render(<ProviderCard provider={provider({ configured: false })} isAdmin />);

    expect(screen.getByText("Not configured")).toBeTruthy();
    expect(screen.getByText(/Set the GitHub credentials/)).toBeTruthy();
  });

  it("invites an admin to connect an unconnected provider", () => {
    render(<ProviderCard provider={provider()} isAdmin returnTo="/projects/new" />);

    expect(screen.getByText("Not connected")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Connect GitHub" }).getAttribute("href")).toBe(
      "/api/integrations/github/connect?returnTo=%2Fprojects%2Fnew",
    );
  });

  it("shows connected accounts with their site, a reconnect state and the project count", () => {
    render(
      <ProviderCard
        provider={provider({
          connections: [
            connection({
              id: "c1",
              label: "acme",
              metadata: { siteUrl: "https://acme.atlassian.net" },
              projectCount: 2,
            }),
            connection({ id: "c2", label: "expired", status: "needs_reconnect", projectCount: 0 }),
          ],
        })}
        isAdmin={false}
      />,
    );

    expect(screen.getByText("Needs attention")).toBeTruthy();
    expect(screen.getByText("https://acme.atlassian.net")).toBeTruthy();
    expect(screen.getByText("Reconnect required")).toBeTruthy();
    expect(screen.getByText("2 projects")).toBeTruthy();
    expect(screen.getByText("Only organization owners and admins can manage integrations.")).toBeTruthy();
  });

  it("offers refresh access, another account and disconnect to an admin", () => {
    render(<ProviderCard provider={provider({ connections: [connection()] })} isAdmin />);

    expect(screen.getByRole("link", { name: "Refresh access" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Add another account" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeTruthy();
  });
});

describe("DisconnectButton", () => {
  it("blocks a connection projects still use, naming how many", () => {
    render(<DisconnectButton connectionId="c1" label="acme" providerName="GitHub" projectCount={2} />);

    expect(screen.getByText("Used by 2 projects")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Disconnect" })).toBeNull();
  });

  it("confirms before disconnecting an unused connection", async () => {
    disconnectConnection.mockResolvedValue({});
    const user = userEvent.setup();
    render(<DisconnectButton connectionId="c1" label="acme" providerName="GitHub" projectCount={0} />);

    await user.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(screen.getByText("Disconnect acme?")).toBeTruthy();
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Disconnect" }));

    await waitFor(() => expect(disconnectConnection).toHaveBeenCalledWith("c1"));
  });
});

describe("SetupChecklist", () => {
  const steps: SetupStep[] = [
    {
      done: false,
      title: "Connect your code",
      description: "Give read-only access.",
      href: "/api/integrations/github/connect",
      cta: "Connect",
    },
    {
      done: true,
      title: "Connect your tickets",
      description: "Link Jira.",
      href: "/settings/integrations",
      cta: "Connect",
    },
    { done: false, title: "Create a project", description: "Pick both.", href: "/projects/new", cta: "Create" },
  ];

  it("marks the next step and links a connect step through a full navigation", () => {
    render(<SetupChecklist steps={steps} isAdmin />);

    const first = screen.getByText("Connect your code").closest("li");
    expect(first?.getAttribute("aria-current")).toBe("step");
    expect(screen.getByRole("link", { name: "Connect" }).getAttribute("href")).toBe("/api/integrations/github/connect");
  });

  it("shows only the next action to an admin", () => {
    render(<SetupChecklist steps={steps} isAdmin />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("tells a member that an admin has to finish setup", () => {
    render(<SetupChecklist steps={steps} isAdmin={false} />);

    expect(screen.getByText(/An organization owner or admin needs to finish/)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("ConnectNotice", () => {
  it("confirms a successful connection", () => {
    render(
      <ConnectNotice params={{ integration: "github", result: "connected" }} providerNames={{ github: "GitHub" }} />,
    );

    expect(screen.getByRole("status").textContent).toContain("GitHub connected");
  });

  it("explains a failed connection with the provider name", () => {
    render(<ConnectNotice params={{ integration: "jira", result: "taken" }} providerNames={{ jira: "Jira Cloud" }} />);

    expect(screen.getByRole("status").textContent).toContain("already connected to another organization");
    expect(screen.getByRole("status").textContent).toContain("Jira Cloud");
  });

  it("renders nothing without a recognized notice", () => {
    const { container } = render(<ConnectNotice params={{}} providerNames={{}} />);
    expect(container.innerHTML).toBe("");
  });
});
