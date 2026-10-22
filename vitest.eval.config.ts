import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";
import base from "./vitest.config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: { ...base.test, include: ["tests/evaluation/**/*.eval.ts"], testTimeout: 180_000 },
});
