import { expect, type Page } from "@playwright/test";

// Shared steps for the end-to-end specs: every spec starts from a fresh browser context and its own user, so it can
// run in any order. The fake providers keep the tracker in memory for the whole server process, so issue keys keep
// increasing across specs; never assume SHOP-1.

let sequence = 0;

export const uniqueEmail = (prefix = "e2e") => `${prefix}-${Date.now()}-${sequence++}@example.test`;

export async function signUp(
  page: Page,
  options: { name?: string; email?: string; organization?: string; password?: string } = {},
) {
  const {
    name = "End To End",
    email = uniqueEmail(),
    organization = "Sample Shop",
    password = "password-1234",
  } = options;

  await page.goto("/sign-up");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Organization name", { exact: true }).fill(organization);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  return { email, password, organization };
}

export async function signIn(page: Page, email: string, password = "password-1234") {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/projects$/);
}

// The checklist connects both fake providers and brings the user back to the new-project form. `beforeSubmit` runs
// once the form is filled, for checks (such as axe) that need the page before it navigates away.
export async function createProject(page: Page, name = "Storefront", beforeSubmit?: () => Promise<void>) {
  await expect(page.getByText("Get set up")).toBeVisible();
  await page.getByRole("link", { name: "Connect", exact: true }).click();
  await expect(page.getByText("Sample repository connected", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Connect", exact: true }).click();
  await expect(page.getByText("Sample tracker connected", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/projects\/new\?/);

  await page.getByRole("radio", { name: "sample/shop" }).check();
  await page.getByRole("radio", { name: "SHOP · Sample shop" }).check();
  await page.getByLabel("Project name", { exact: true }).fill(name);
  await beforeSubmit?.();
  await page.getByRole("button", { name: "Create project" }).click();

  await expect(page.getByText(/^Project created\./)).toBeVisible();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/);
  return page.url();
}

export async function draftTicket(page: Page, request: string) {
  await page.getByLabel("Draft a ticket", { exact: true }).fill(request);
  await page.getByRole("button", { name: "Draft ticket" }).click();
  await expect(page).toHaveURL(/\/analyses\/[0-9a-f-]+$/);
}

// Approves a settled draft and returns the key the fake tracker assigned.
export async function approveAndPublish(page: Page) {
  await expect(page.getByText("Nothing left to decide")).toBeVisible();
  await page.getByRole("button", { name: /^Approve & create in Sample tracker$/ }).click();
  const confirmation = page.getByRole("status").filter({ hasText: /Created SHOP-\d+ in Sample tracker/ });
  await expect(confirmation).toBeVisible();
  const text = (await confirmation.textContent()) ?? "";
  return /SHOP-\d+/.exec(text)?.[0] ?? "";
}

export async function openProjectSection(page: Page, name: "Draft" | "Audit" | "History" | "Settings") {
  await page.getByRole("link", { name, exact: true }).click();
  await expect(page.getByRole("link", { name, exact: true })).toHaveAttribute("aria-current", "page");
}
