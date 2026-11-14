import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    env: {
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123",
      BETTER_AUTH_URL: "http://localhost:3000",
      ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
      // The integration suite runs dozens of analyses as one user; the per-minute production guard would fire here.
      ANALYSIS_PER_USER_PER_DAY: "1000",
      ANALYSIS_TOTAL_PER_DAY: "10000",
      ANALYSIS_PER_USER_PER_MINUTE: "1000",
    },
    // Component tests are `.tsx` and opt into jsdom with a `@vitest-environment` comment.
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/core/**", "src/features/**", "src/infrastructure/**", "src/integrations/**"],
      reporter: ["text-summary", "html"],
      thresholds: { statements: 55, branches: 50, functions: 52, lines: 55 },
    },
    alias: { "server-only": new URL("./tests/stubs/server-only.ts", import.meta.url).pathname },
  },
});
