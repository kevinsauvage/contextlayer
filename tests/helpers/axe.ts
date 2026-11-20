import axe from "axe-core";
import { expect } from "vitest";
import { WCAG_TAGS } from "./wcag";

// jsdom has no layout, so it cannot evaluate colour contrast; the Playwright checks cover that. Everything about
// names, roles, landmarks and labels is checked here, next to the component that renders it.
export async function expectNoA11yViolations(container: Element) {
  const { violations } = await axe.run(container, {
    runOnly: { type: "tag", values: WCAG_TAGS },
    rules: { "color-contrast": { enabled: false } },
  });

  expect(
    violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.map((node) => node.target.join(" ")),
    })),
  ).toEqual([]);
}
