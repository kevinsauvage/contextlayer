import { expect, test } from "@playwright/test";
import { createProject, draftTicket, signUp } from "./helpers";

// Open questions, the chat redraft, and the confirmation that protects manual edits.
test("answers an open question, redrafts from the chat, and protects manual edits", async ({ page }) => {
  await signUp(page, { organization: "Question Shop" });
  await createProject(page, "Question storefront");
  await draftTicket(page, "Change the banner title on the home page [[question]]");

  await expect(page.getByRole("heading", { name: "Open questions", level: 2 })).toBeVisible();
  await expect(page.getByText("Which rounding should the export use?", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Half up/ })).toBeVisible();

  await page.getByLabel("Answer: Which rounding should the export use?").fill("Half up");
  await page.getByRole("button", { name: "Update draft with 1 answer" }).click();

  await expect(page.getByText("Decided earlier (1)")).toBeVisible();
  await expect(page.getByText("Half up").first()).toBeVisible();

  // A chat message redrafts without touching the questions.
  await page.getByLabel("Ask for a change").fill("Also mention the refunds");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByLabel("Ask for a change")).toHaveValue("");
  await expect(page.getByText("Also mention the refunds", { exact: true })).toBeVisible();
  await expect(page.getByText("Here is the draft:")).toBeVisible();

  // A manual edit turns the next send into a confirmation.
  await page.getByRole("tab", { name: "Edit" }).click();
  const title = page.getByLabel("Title");
  await title.fill("Banner title, manually edited");
  await page.getByLabel("Ask for a change").fill("One more change");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "You edited the draft." })).toBeVisible();
  await page.getByRole("button", { name: "Keep my edits" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "You edited the draft." })).toBeHidden();
  await expect(page.getByLabel("Title")).toHaveValue("Banner title, manually edited");

  await page.getByRole("button", { name: "Send" }).click();
  await page.getByRole("button", { name: "Discard edits and send" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "You edited the draft." })).toBeHidden();
  await expect(page.getByLabel("Ask for a change")).toHaveValue("");
  await expect(page.getByText("Banner title, manually edited")).toBeHidden();
});

test("a failed redraft keeps the previous draft and Retry recovers", async ({ page }) => {
  await signUp(page, { organization: "Retry Shop" });
  await createProject(page, "Retry storefront");
  await draftTicket(page, "Change the banner title on the home page");

  await page.getByLabel("Ask for a change").fill("Please fail once [[fail-once]]");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("The redraft failed")).toBeVisible();
  await expect(page.getByText("This is the previous draft; it cannot be approved until a run succeeds.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Retry", exact: true }).click();

  await expect(page.getByText("The redraft failed")).toBeHidden();
  await expect(page.getByText("Here is the draft:")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Approve & create in Sample tracker$/ })).toBeVisible();
});
