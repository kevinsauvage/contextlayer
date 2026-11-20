import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./a11y";
import { approveAndPublish, createProject, draftTicket, signUp } from "./helpers";

// The whole path a new team takes, on the fake providers: sign up, create an organization, connect code and tickets from the setup checklist,
// create a project, draft a ticket from a request, and publish it to the in-memory tracker.
test("a new user drafts a ticket and publishes it", async ({ page }) => {
  await page.goto("/sign-up");
  await expectNoA11yViolations(page, "sign-up");

  await signUp(page, { organization: "Sample Shop" });
  await expectNoA11yViolations(page, "projects setup");

  await createProject(page, "Storefront", () => expectNoA11yViolations(page, "new project"));
  await expectNoA11yViolations(page, "project request");

  await draftTicket(page, "Change the banner title on the home page");
  await expect(page.getByText("Nothing left to decide")).toBeVisible();
  await expectNoA11yViolations(page, "analysis preview");

  await page.getByRole("tab", { name: "Edit" }).click();
  await expectNoA11yViolations(page, "analysis edit");

  const key = await approveAndPublish(page);
  await expect(page.getByText(`Created ${key} in Sample tracker`)).toBeVisible();
  await expectNoA11yViolations(page, "published ticket");
  await expect(page.getByRole("link", { name: new RegExp(`Open ${key}`) })).toHaveAttribute(
    "href",
    `https://tracker.invalid/browse/${key}`,
  );
});
