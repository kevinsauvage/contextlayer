import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { WCAG_TAGS } from "../helpers/wcag";

const theme = async (page: Page, scheme: "light" | "dark") => {
  await page.emulateMedia({ colorScheme: scheme });
  if (scheme === "dark") await expect(page.locator("html")).toHaveClass(/dark/);
  else await expect(page.locator("html")).not.toHaveClass(/dark/);
};

// Both themes, because the tokens carry separate values and contrast fails differently in each. axe cannot check
// everything, so this is a floor, not a certificate.
export async function expectNoA11yViolations(page: Page, where: string) {
  for (const scheme of ["light", "dark"] as const) {
    await theme(page, scheme);
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    const blocking = violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(
      blocking.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        targets: violation.nodes.map((node) => node.target.join(" ")),
      })),
      `${where} (${scheme})`,
    ).toEqual([]);
  }
  await page.emulateMedia({ colorScheme: "light" });
}
