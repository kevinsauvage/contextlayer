import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

const forbidLayers = (message, ...groups) => ({
  "no-restricted-imports": ["error", { patterns: groups.map((group) => ({ group, message })) }],
});

const appLayers = (...names) => names.flatMap((name) => [`@/${name}`, `@/${name}/**`]);

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
      "import/no-cycle": ["error", { ignoreExternal: true }],
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

  // Dependencies point inward: app → features → core. See AGENTS.md.
  {
    files: ["src/core/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: appLayers("app", "components", "features", "infrastructure", "integrations", "lib"),
              message: "core is pure: it may only import from core.",
            },
            {
              group: [
                "next",
                "react",
                "react-dom",
                "server-only",
                "drizzle-orm",
                "postgres",
                "octokit",
                "ai",
                "better-auth",
              ].flatMap((name) => [name, `${name}/**`]),
              message: "core is pure: framework and I/O packages belong in features, infrastructure or integrations.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/features/**"],
    rules: forbidLayers("features must not depend on the UI layers.", appLayers("app", "components")),
  },
  {
    files: ["src/integrations/**"],
    rules: forbidLayers(
      "integrations implement core interfaces and must not depend on features or the UI.",
      appLayers("app", "components", "features"),
    ),
  },
  {
    files: ["src/infrastructure/**"],
    rules: forbidLayers(
      "infrastructure must not depend on features, integrations or the UI.",
      appLayers("app", "components", "features", "integrations"),
    ),
  },
  {
    files: ["src/components/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: appLayers("app", "integrations"),
              message: "components talk to features (actions) and core types only.",
            },
            {
              regex: "^@/infrastructure/(?!auth/client$)",
              message: "components may only use the browser auth client from infrastructure.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/lib/**"],
    rules: forbidLayers(
      "lib is a leaf: it must not import from application layers.",
      appLayers("app", "components", "core", "features", "infrastructure", "integrations"),
    ),
  },
]);

export default eslintConfig;
