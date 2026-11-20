import { expect, test } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers";

// Invite a second user, accept the invitation in another browser context, then check what a member may do.
test("an invitation is accepted by the invited account, and members stay read-only", async ({ browser }) => {
  const baseURL = test.info().project.use.baseURL ?? "http://localhost:3100";
  const adminContext = await browser.newContext({ baseURL });
  const admin = await adminContext.newPage();
  const invitee = uniqueEmail("invitee");

  await signUp(admin, { name: "Admin User", email: uniqueEmail("admin"), organization: "Invite Shop" });
  await admin.goto("/settings/organization");

  await admin.getByLabel("Email").fill(invitee);
  await admin.getByRole("button", { name: "Create invite" }).click();
  await expect(admin.getByRole("status").filter({ hasText: `Invitation for ${invitee} created` })).toBeVisible();

  await adminContext.grantPermissions(["clipboard-read", "clipboard-write"]);
  await admin.getByRole("button", { name: "Copy link" }).first().click();
  await expect(admin.getByText("Copied")).toBeVisible();
  const invitationUrl = await admin.evaluate(() => navigator.clipboard.readText());
  expect(invitationUrl).toContain("/invitations/");

  const memberContext = await browser.newContext({ baseURL });
  const member = await memberContext.newPage();
  await member.goto(invitationUrl);
  await expect(member).toHaveURL(/\/sign-in\?next=/);

  await member.getByRole("link", { name: "Sign up" }).click();
  await member.getByLabel("Name").fill("Member User");
  await member.getByLabel("Email").fill(invitee);
  await member.getByLabel("Password").fill("password-1234");
  await member.getByRole("button", { name: "Create account" }).click();

  await expect(member.getByRole("heading", { name: "Join Invite Shop" })).toBeVisible();
  await member.getByRole("button", { name: "Accept and join" }).click();
  await expect(member).toHaveURL(/\/projects$/);

  await member.goto("/settings/organization");
  await expect(member.getByRole("heading", { name: "Organization settings" })).toBeVisible();
  await expect(member.locator("#main").getByText(invitee)).toBeVisible();
  await expect(member.getByRole("heading", { name: "Invite a teammate" })).toBeHidden();
  await expect(member.getByRole("button", { name: "Delete organization" })).toBeHidden();
  await expect(member.getByRole("combobox", { name: "Member role" })).toHaveCount(0);

  await member.goto("/settings/integrations");
  await expect(member.getByText("Only organization owners and admins can manage integrations.").first()).toBeVisible();

  // The owner still manages the member: change the role, then remove them.
  await admin.goto("/settings/organization");
  await expect(admin.locator("#main").getByText(invitee)).toBeVisible();
  await admin.getByRole("combobox", { name: "Member role" }).selectOption("admin");
  await expect(admin.getByText("Role updated.").first()).toBeVisible();

  await admin.getByRole("button", { name: "Remove" }).click();
  await expect(admin.getByText("Member removed.").first()).toBeVisible();
  await expect(admin.locator("#main").getByText(invitee)).toBeHidden();

  await adminContext.close();
  await memberContext.close();
});
