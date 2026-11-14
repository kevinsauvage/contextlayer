import { describe, expect, it } from "vitest";
import { isReadablePath } from "@/integrations/source-filters";

describe("isReadablePath", () => {
  it.each([
    "config/secrets.yml",
    "credentials.json",
    "certs/server.pem",
    "certs/server.key",
    "id_rsa",
    "prod.tfvars",
    ".npmrc",
    "service-account-prod.json",
    "appsettings.Production.json",
    ".env.local",
  ])("refuses a file that usually holds credentials: %s", (path) => {
    expect(isReadablePath(path)).toBe(false);
  });

  it.each(["src/api/keys.ts", "src/cart/total.ts", "docs/README.md"])("still reads code and docs: %s", (path) => {
    expect(isReadablePath(path)).toBe(true);
  });
});
