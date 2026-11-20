import { defineConfig, devices } from "@playwright/test";
import { E2E_DATABASE_URL } from "./tests/e2e/database";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

// The browser suite runs against a production build on its own port and database (`E2E_FAKE_PROVIDERS`), so it never
// touches the development server or its data. Specs run one at a time: the fake providers keep their tracker in the
// server process, so they share it (each uses its own user and reads the keys it created).
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  // One server process and one fake tracker: parallel workers would race the provider store and the sign-up limiter.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: BASE_URL,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      E2E_FAKE_PROVIDERS: "true",
      BETTER_AUTH_URL: BASE_URL,
      DATABASE_URL: E2E_DATABASE_URL,
    },
  },
});
