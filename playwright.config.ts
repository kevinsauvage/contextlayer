import { defineConfig, devices } from "@playwright/test";
import { E2E_DATABASE_URL } from "./tests/e2e/database";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

// One smoke run of the real app on fake providers (E2E_FAKE_PROVIDERS): a production build on its own port and
// database, so it never touches the development server or its data. `next dev` cannot run twice in one checkout.
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
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
