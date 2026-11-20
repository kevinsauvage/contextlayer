// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectForm } from "@/components/projects/project-form";
import type { ProviderOverview } from "@/features/integrations/overview";

const createProject = vi.hoisted(() => vi.fn(async (_state: unknown, _formData: FormData) => ({})));
vi.mock("@/features/projects/actions", () => ({ createProject }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(() => {
  cleanup();
  createProject.mockClear();
});

const connection = (id: string, label: string) => ({
  id,
  provider: "github",
  label,
  status: "active" as const,
  metadata: {},
  createdAt: new Date(),
  projectCount: 0,
});

const source = (overrides: Partial<ProviderOverview> = {}): ProviderOverview => ({
  id: "github",
  name: "GitHub",
  kind: "source",
  description: "Code",
  accountNoun: "account",
  resourceNoun: "repository",
  canAddAccount: true,
  exclusive: true,
  supportsSubdirectory: true,
  configured: true,
  connections: [connection("c-source", "acme")],
  ...overrides,
});

const tracker = (overrides: Partial<ProviderOverview> = {}): ProviderOverview => ({
  id: "jira",
  name: "Jira Cloud",
  kind: "tracker",
  description: "Tickets",
  accountNoun: "site",
  resourceNoun: "project",
  canAddAccount: false,
  exclusive: false,
  configured: true,
  connections: [connection("c-tracker", "acme")],
  ...overrides,
});

const lists = {
  "c-source": { resources: [{ id: "acme/web", label: "acme/web" }] },
  "c-tracker": { resources: [{ id: "SHOP", label: "SHOP · Shop" }] },
};

describe("ProjectForm", () => {
  it("asks for both connections before a project can be created", () => {
    render(
      <ProjectForm
        sources={[source({ connections: [] })]}
        trackers={[tracker({ connections: [] })]}
        resourceLists={{}}
      />,
    );

    expect(screen.getAllByText(/Nothing connected yet/)).toHaveLength(2);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Create project" }).disabled).toBe(true);
    expect(screen.getByText("Connect your code and your tickets first.")).toBeTruthy();
  });

  it("offers the provider connect links", () => {
    render(
      <ProjectForm
        sources={[source({ connections: [] })]}
        trackers={[tracker({ connections: [] })]}
        resourceLists={{}}
      />,
    );

    expect(screen.getAllByRole("link", { name: "Connect GitHub" })[0]?.getAttribute("href")).toBe(
      "/api/integrations/github/connect?returnTo=%2Fprojects%2Fnew",
    );
    expect(screen.getAllByRole("link", { name: "Connect Jira Cloud" })[0]).toBeTruthy();
  });

  it("names the project after the chosen repository until the name is edited", async () => {
    const user = userEvent.setup();
    render(<ProjectForm sources={[source()]} trackers={[tracker()]} resourceLists={lists} />);

    await user.click(screen.getByRole("radio", { name: "acme/web" }));
    const name = screen.getByLabelText<HTMLInputElement>("Project name");
    expect(name.value).toBe("web");

    await user.clear(name);
    await user.type(name, "Storefront");
    await user.click(screen.getByRole("radio", { name: "acme/web" }));
    expect(screen.getByLabelText<HTMLInputElement>("Project name").value).toBe("Storefront");
  });

  it("submits both sides, the folder scope and the name", async () => {
    const user = userEvent.setup();
    render(<ProjectForm sources={[source()]} trackers={[tracker()]} resourceLists={lists} />);

    await user.click(screen.getByRole("radio", { name: "acme/web" }));
    await user.click(screen.getByRole("radio", { name: "SHOP · Shop" }));
    await user.type(screen.getByLabelText("Folder (optional)"), "apps/web");
    await user.click(screen.getByRole("button", { name: "Create project" }));

    await waitFor(() => expect(createProject).toHaveBeenCalledOnce());
    const data = createProject.mock.calls[0]?.[1];
    expect(Object.fromEntries(data ?? new FormData())).toMatchObject({
      name: "web",
      sourceConnectionId: "c-source",
      sourceResourceId: "acme/web",
      sourceSubdirectory: "apps/web",
      trackerConnectionId: "c-tracker",
      trackerResourceId: "SHOP",
    });
  });

  it("shows an account selector when a provider has several connections", async () => {
    const user = userEvent.setup();
    const many = source({
      connections: [connection("c-source", "acme"), connection("c-two", "other")],
    });
    render(<ProjectForm sources={[many]} trackers={[tracker()]} resourceLists={lists} />);

    const account = screen.getByLabelText<HTMLSelectElement>("Account");
    expect(account.value).toBe("c-source");
    expect(screen.getByRole("radio", { name: "acme/web" })).toBeTruthy();

    await user.selectOptions(account, "c-two");
    expect(screen.getByText("This connection was not loaded. Reload the page.")).toBeTruthy();
  });

  it("does not offer a folder for a provider that cannot narrow a repository", () => {
    render(
      <ProjectForm sources={[source({ supportsSubdirectory: false })]} trackers={[tracker()]} resourceLists={lists} />,
    );

    expect(screen.queryByLabelText("Folder (optional)")).toBeNull();
  });

  it("shows a repository list error from the server", () => {
    render(
      <ProjectForm
        sources={[source()]}
        trackers={[tracker()]}
        resourceLists={{ ...lists, "c-source": { error: "The GitHub grant was revoked" } }}
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain("The GitHub grant was revoked");
  });
});
