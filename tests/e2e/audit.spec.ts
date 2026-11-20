import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./a11y";
import { approveAndPublish, createProject, draftTicket, openProjectSection, signUp } from "./helpers";

// Audit the issue a create run just published, then apply the proposal to it.
test("a user audits a published ticket and applies the proposal", async ({ page }) => {
  await signUp(page, { organization: "Audit Shop" });
  const projectUrl = await createProject(page, "Audited storefront");
  await draftTicket(page, "Change the banner title on the home page");
  const key = await approveAndPublish(page);
  expect(key).toMatch(/^SHOP-\d+$/);

  await page.goto(projectUrl);
  await openProjectSection(page, "Audit");
  await page.getByLabel(/Audit an existing Sample tracker ticket/).fill(key);
  await page.getByRole("button", { name: "Audit ticket" }).click();

  await expect(page).toHaveURL(/\/analyses\/[0-9a-f-]+$/);
  await expect(page.getByText("Sample audit.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Proposed ticket" })).toBeVisible();
  await expect(page.getByText("No findings.")).toBeVisible();
  await expectNoA11yViolations(page, "audit");

  await page.getByRole("button", { name: "Approve & update the Sample tracker ticket" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: `Replaces the title and description of ${key}` }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Replace the ticket" }).click();
  await expect(page.getByRole("status").filter({ hasText: `Updated ${key} in Sample tracker` })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(`Open ${key}`) })).toHaveAttribute(
    "href",
    `https://tracker.invalid/browse/${key}`,
  );

  await page.goto(projectUrl);
  await openProjectSection(page, "History");
  await expect(page.getByText(key).first()).toBeVisible();
});

test("an audit refuses a key outside the project", async ({ page }) => {
  await signUp(page, { organization: "Audit Shop" });
  await createProject(page, "Audited storefront");
  await openProjectSection(page, "Audit");

  await page.getByLabel(/Audit an existing Sample tracker ticket/).fill("OTHER-1");
  await page.getByRole("button", { name: "Audit ticket" }).click();

  await expect(page.getByText("Enter an issue key like SHOP-1")).toBeVisible();
  await expect(page).toHaveURL(/\/audit$/);
});
