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

  it("leaves code that only names a credential readable", () => {
    const code = [
      "const token = getToken();",
      "const accessToken = session.accessToken;",
      "export const API_KEY = process.env.API_KEY;",
      "  passwordField: z.string().min(10),",
      "  token: string;",
      "  password: ${DB_PASSWORD}",
      '  "forgotPassword": "Forgot your password?",',
    ].join("\n");

    expect(redactSecrets(code)).toBe(code);
  });

  it("masks a quoted value with spaces, a connection-string password, a bearer token and a JWT", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV";
    const redacted = redactSecrets(
      [
        'password = "my pass-word 1"',
        "DATABASE_URL=postgres://user:hunter22@host/db",
        "Authorization: Bearer abcdefghijklmnop1234",
        `session=${jwt}`,
        "API_KEY=sk.live.abc123",
      ].join("\n"),
    );

    expect(redacted).toBe(
      [
        "password = [redacted]",
        "DATABASE_URL=postgres://user:[redacted]@host/db",
        "Authorization: Bearer [redacted]",
        "session=[redacted]",
        "API_KEY=[redacted]",
      ].join("\n"),
    );
  });

  it("keeps the blank lines after a masked assignment, so later citations keep their line numbers", () => {
    const text = "password=abcdef\n\n  token: 'abcdefgh',\n\n\nnext line";

    const redacted = redactSecrets(text);

    expect(redacted).toBe("password=[redacted]\n\n  token: [redacted]\n\n\nnext line");
  });
});
