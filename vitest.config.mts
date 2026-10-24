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
    },
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/core/**", "src/features/**", "src/infrastructure/**", "src/integrations/**"],
      reporter: ["text-summary", "html"],
      thresholds: { statements: 55, branches: 50, functions: 52, lines: 55 },
    },
    alias: { "server-only": new URL("./tests/stubs/server-only.ts", import.meta.url).pathname },
  },
});
