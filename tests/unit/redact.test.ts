import { describe, expect, it } from "vitest";
import { redactSecrets } from "@/core/context/redact";

const PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA
-----END RSA PRIVATE KEY-----`;

describe("redactSecrets", () => {
  it("masks a private key block and keeps the line structure", () => {
    const text = `before\n${PRIVATE_KEY}\nafter`;

    const redacted = redactSecrets(text);

    expect(redacted).not.toContain("MIIEowIBAAKCAQEA");
    expect(redacted).toContain("[redacted private key]");
    expect(redacted.split("\n")).toHaveLength(text.split("\n").length);
  });

  it("masks the token shapes providers issue", () => {
    const secrets = [
      "AKIAIOSFODNN7EXAMPLE",
      "ghp_abcdefghijklmnopqrstuvwxyz0123456789",
      "github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz",
      "xoxb-1234567890-abcdefghij",
    ];

    const redacted = redactSecrets(secrets.join("\n"));

    for (const secret of secrets) expect(redacted).not.toContain(secret);
    expect(redacted.match(/\[redacted\]/g)).toHaveLength(secrets.length);
  });

  it("masks credential assignments and leaves ordinary lines alone", () => {
    const redacted = redactSecrets(
      ["POSTGRES_PASSWORD: hunter2", '"apiKey": "sk-live-123456",', "const total = 42;"].join("\n"),
    );

    expect(redacted).toContain("POSTGRES_PASSWORD: [redacted]");
    expect(redacted).toContain('"apiKey": [redacted]');
    expect(redacted).toContain("const total = 42;");
  });

  it("keeps the blank lines after a masked assignment, so later citations keep their line numbers", () => {
    const text = "password=abcdef\n\n  token: 'abcdefgh',\n\n\nnext line";

    const redacted = redactSecrets(text);

    expect(redacted).toBe("password=[redacted]\n\n  token: [redacted]\n\n\nnext line");
  });
});
