// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NavLink } from "@/components/layout/nav-link";
import { SideNavLink } from "@/components/layout/side-nav-link";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { asRoute } from "@/components/as-route";

const state = vi.hoisted(() => ({ pathname: "/projects" }));

vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));

afterEach(cleanup);

describe("NavLink", () => {
  it("marks the current section, including its children", () => {
    state.pathname = "/settings/integrations";
    render(
      <nav aria-label="Main">
        <NavLink href="/projects">Projects</NavLink>
        <NavLink href="/settings/integrations">Integrations</NavLink>
      </nav>,
    );

    expect(screen.getByRole("link", { name: "Projects" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("link", { name: "Integrations" }).getAttribute("aria-current")).toBe("page");
  });
});

describe("SideNavLink", () => {
  it("marks a section for itself and its children, but not a sibling", () => {
    state.pathname = "/projects/abc/settings";
    render(
      <nav aria-label="Main">
        <SideNavLink href="/projects" icon={<span />}>
          Projects
        </SideNavLink>
        <SideNavLink href={asRoute("/projects/abc")} icon={<span />}>
          Current project
        </SideNavLink>
        <SideNavLink href="/settings/integrations" icon={<span />}>
          Integrations
        </SideNavLink>
      </nav>,
    );

    expect(screen.getByRole("link", { name: "Projects" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Current project" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Integrations" }).getAttribute("aria-current")).toBeNull();
  });
});

describe("ProjectTabs", () => {
  it("links every section and marks the open one", () => {
    state.pathname = "/projects/p1/audit";
    render(<ProjectTabs projectId="p1" />);

    const audit = screen.getByRole("link", { name: "Audit" });
    expect(audit.getAttribute("href")).toBe("/projects/p1/audit");
    expect(audit.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Draft" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("link", { name: "History" }).getAttribute("href")).toBe("/projects/p1/history");
    expect(screen.getByRole("link", { name: "Settings" })).toBeTruthy();
  });
});
