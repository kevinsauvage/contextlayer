import { expect, test } from "@playwright/test";

// The whole path a new team takes, on the fake providers: sign up, create an organization, connect code and tickets from the setup checklist,
// create a project, draft a ticket from a request, and publish it to the in-memory tracker.
test("a new user drafts a ticket and publishes it", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.test`;

  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("End To End");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password-1234");
  await page.getByRole("button", { name: "Create account" }).click();

  await page.getByLabel("Organization name").fill("Sample Shop");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/projects$/);

  // The checklist starts each consent itself and brings the user back to the next step.
  await page.getByRole("link", { name: "Connect", exact: true }).click();
  await expect(page.getByText("Sample repository connected", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/projects\?/);
  await page.getByRole("link", { name: "Connect", exact: true }).click();
  await expect(page.getByText("Sample tracker connected", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/projects\/new\?/);

  await page.getByText("sample/shop", { exact: true }).click();
  await page.getByText("SHOP · Sample shop", { exact: true }).click();
  await page.getByLabel("Project name").fill("Storefront");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByText(/^Project created\./)).toBeVisible();

  await page.getByLabel("Draft a ticket").fill("Change the banner title on the home page");
  await page.getByRole("button", { name: "Draft ticket" }).click();
  await expect(page).toHaveURL(/\/analyses\//);
  await expect(page.getByText("Nothing left to decide")).toBeVisible();

  await page.getByRole("button", { name: "Approve & create in Sample tracker" }).click();
  await expect(page.getByText("Created SHOP-1 in Sample tracker")).toBeVisible();
  await expect(page.getByRole("link", { name: /Open SHOP-1/ })).toHaveAttribute(
    "href",
    "https://tracker.invalid/browse/SHOP-1",
  );
});
