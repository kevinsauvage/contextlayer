import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "coverage/**",
    "drizzle/**",
    "next-env.d.ts",
    "tests/fixtures/**",
    "tests/evaluation/results/**",
  ]),

  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    settings: { "import/ignore": ["node_modules"] },
    rules: {
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-confusing-void-expression": ["error", { ignoreArrowShorthand: true }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "all" },
      ],
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "import/no-duplicates": "error",
      eqeqeq: ["error", "always"],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-var": "error",
      "prefer-const": "error",
    },
  },
  { files: ["**/*.mjs"], extends: [tseslint.configs.disableTypeChecked] },
  // Fakes implement async interfaces without awaiting anything.
  { files: ["tests/**"], rules: { "@typescript-eslint/require-await": "off" } },

  // Layer boundaries and the core/lib package allow-lists live in .dependency-cruiser.cjs (`pnpm deps:check`):
  // one mechanism, run by `pnpm check` and CI. ESLint keeps only what is about globals, not imports.
  {
    files: ["src/core/**"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "core is pure: network I/O belongs in an integration." },
        { name: "process", message: "core is pure: configuration belongs in infrastructure." },
        { name: "Buffer", message: "core is pure: no Node I/O belongs here." },
        { name: "setTimeout", message: "core is pure: timing belongs in the caller." },
      ],
    },
  },
]);

export default eslintConfig;
