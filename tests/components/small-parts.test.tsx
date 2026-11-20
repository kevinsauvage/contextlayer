// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LocalTime } from "@/components/local-time";
import { FormError } from "@/components/form-error";
import { PageHeader } from "@/components/page-header";
import { CenteredShell } from "@/components/layout/centered-shell";
import { Logo } from "@/components/layout/logo";
import { ProviderIcon } from "@/components/integrations/provider-icon";
import { ProjectFormSkeleton } from "@/components/projects/project-form-skeleton";

afterEach(cleanup);

describe("LocalTime", () => {
  it("renders a machine-readable time with the reader's own formatting", () => {
    const date = new Date("2026-01-05T12:34:00.000Z");
    const { container } = render(<LocalTime date={date} options={{ month: "short", day: "numeric" }} />);

    const time = container.querySelector("time");
    expect(time?.getAttribute("dateTime")).toBe("2026-01-05T12:34:00.000Z");
    expect(time?.textContent).not.toBe("");
  });
});

describe("FormError", () => {
  it("renders an alert with its id, and nothing without an error", () => {
    const { rerender } = render(<FormError error="Too short" id="request-error" />);
    expect(screen.getByRole("alert").getAttribute("id")).toBe("request-error");
    expect(screen.getByText("Too short")).toBeTruthy();

    rerender(<FormError error={undefined} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("PageHeader", () => {
  it("shows a breadcrumb, title, description and actions", () => {
    render(
      <PageHeader
        breadcrumb={<span>Projects</span>}
        title="Storefront"
        description="A project"
        actions={<button type="button">New ticket</button>}
      />,
    );

    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Storefront" })).toBeTruthy();
    expect(screen.getByText("A project")).toBeTruthy();
    expect(screen.getByRole("button", { name: "New ticket" })).toBeTruthy();
  });
});

describe("CenteredShell and Logo", () => {
  it("renders the product mark and the card content", () => {
    render(
      <CenteredShell title="Sign in" description="Welcome back">
        <button type="button">Continue</button>
      </CenteredShell>,
    );

    expect(screen.getByText("ContextLayer")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByText("Welcome back")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
  });

  it("keeps the logo decorative", () => {
    const { container } = render(<Logo />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("ProviderIcon", () => {
  it("picks a different icon for a source and a tracker, both hidden from assistive tech", () => {
    const { container, rerender } = render(<ProviderIcon kind="source" />);
    const source = container.innerHTML;
    rerender(<ProviderIcon kind="tracker" />);

    expect(container.innerHTML).not.toBe(source);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("ProjectFormSkeleton", () => {
  it("announces that connections are loading", () => {
    render(<ProjectFormSkeleton />);

    expect(screen.getByRole("status").textContent).toContain("Loading connections");
  });
});
