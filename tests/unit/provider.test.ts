import { describe, expect, it } from "vitest";
import {
  describeProvider,
  isSafeSubdirectory,
  type IntegrationProvider,
  type ProviderDescriptor,
} from "@/core/integrations/provider";

const provider: IntegrationProvider = {
  id: "github",
  name: "GitHub",
  kind: "source",
  description: "Read-only repositories",
  accountNoun: "account",
  resourceNoun: "repository",
  canAddAccount: true,
  exclusive: true,
  supportsSubdirectory: true,
  isConfigured: () => true,
  authorizeUrl: () => "https://github.test/authorize",
  complete: async () => ({ status: "cancelled" }),
  listResources: async () => [],
  openSource: async () => {
    throw new Error("unused");
  },
  scopeResource: (id) => id,
};

describe("describeProvider", () => {
  it("exports exactly the fields the UI needs, without the functions", () => {
    const descriptor: ProviderDescriptor = describeProvider(provider);

    expect(descriptor).toEqual({
      id: "github",
      name: "GitHub",
      kind: "source",
      description: "Read-only repositories",
      accountNoun: "account",
      resourceNoun: "repository",
      canAddAccount: true,
      exclusive: true,
      supportsSubdirectory: true,
    });
    expect(Object.values(descriptor).some((value) => typeof value === "function")).toBe(false);
  });

  it("omits an optional field a provider does not declare", () => {
    const { supportsSubdirectory: _supports, ...tracker } = provider;
    expect(describeProvider(tracker as IntegrationProvider).supportsSubdirectory).toBeUndefined();
  });
});

describe("isSafeSubdirectory", () => {
  it.each(["apps/web", "packages/ui/src", "src", "a-b_c.d/e"])("accepts %s", (path) => {
    expect(isSafeSubdirectory(path)).toBe(true);
  });

  it.each([
    ["", "empty"],
    ["/apps/web", "absolute"],
    ["apps//web", "empty segment"],
    ["apps/../etc", "parent"],
    ["..", "parent only"],
    [".", "current"],
    ["apps/web/", "trailing slash"],
    ["apps/web#main", "scope separator"],
    ["apps/web?tab=1", "query"],
  ])("refuses %s (%s)", (path) => {
    expect(isSafeSubdirectory(path)).toBe(false);
  });
});
