import { describe, expect, it } from "vitest";
import { isReadablePath, searchableTerms, skippedTerms } from "@/integrations/source-filters";

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

describe("searchableTerms", () => {
  it("drops a term that carries a search qualifier and reports it as skipped", () => {
    const terms = ["cart", "x repo:acme/other", "org:acme", "-path:src", "aria-label"];

    expect(searchableTerms(terms)).toEqual(["cart", "aria-label"]);
    expect(skippedTerms(terms)).toEqual(["x repo:acme/other", "org:acme", "-path:src"]);
  });
});
