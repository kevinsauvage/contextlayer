import { expect, test } from "@playwright/test";
import { createProject, openProjectSection, signIn, signUp } from "./helpers";

test("renames the organization, switches between organizations, and signs out and back in", async ({ page }) => {
  const { email } = await signUp(page, { name: "Ada Lovelace", organization: "Old name" });

  await page.goto("/settings/organization");
  const name = page.getByLabel("Name", { exact: true });
  await name.fill("New name");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Organization renamed.")).toBeVisible();
  await expect(name).toHaveValue("New name");

  await page.getByRole("button", { name: /New name/ }).click();
  await page.getByRole("menuitem", { name: /New organization/ }).click();
  await expect(page).toHaveURL(/\/organizations\/new$/);
  await page.getByLabel("Organization name", { exact: true }).fill("Second org");
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole("button", { name: /Second org/ })).toBeVisible();

  await page.getByRole("button", { name: /Second org/ }).click();
  await page.getByRole("menuitem", { name: /New name/ }).click();
  await expect(page.getByRole("button", { name: /New name/ })).toBeVisible();

  await page.getByRole("button", { name: /Ada Lovelace/ }).click();
  await page.getByRole("menuitem", { name: /Sign out/ }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await signIn(page, email);
  await expect(page.getByRole("button", { name: /New name/ })).toBeVisible();
});

test("creates and deletes a project from its settings", async ({ page }) => {
  await signUp(page, { organization: "Project Shop" });
  await createProject(page, "Deletable project");

  await openProjectSection(page, "Settings");
  await page.getByRole("button", { name: "Delete project" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete project" }).click();

  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByText("Project deleted.")).toBeVisible();
  await expect(page.getByText("Deletable project")).toBeHidden();
});
