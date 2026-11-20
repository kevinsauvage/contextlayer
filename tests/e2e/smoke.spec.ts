import { expect, test } from "@playwright/test";
import { approveAndPublish, createProject, draftTicket, signUp } from "./helpers";

// The whole path a new team takes, on the fake providers: sign up, create an organization, connect code and tickets from the setup checklist,
// create a project, draft a ticket from a request, and publish it to the in-memory tracker.
test("a new user drafts a ticket and publishes it", async ({ page }) => {
  await signUp(page, { organization: "Sample Shop" });
  await createProject(page, "Storefront");
  await draftTicket(page, "Change the banner title on the home page");

  await expect(page.getByText("Nothing left to decide")).toBeVisible();
  const key = await approveAndPublish(page);

  await expect(page.getByText(`Created ${key} in Sample tracker`)).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(`Open ${key}`) })).toHaveAttribute(
    "href",
    `https://tracker.invalid/browse/${key}`,
  );
});
