/**
 * One mechanism for the dependency rules in AGENTS.md: layers, the packages `core` and `lib` may use, and cycles.
 * `pnpm deps:check` runs it locally; `pnpm check` and CI run the same command.
 */

/** @type {import('dependency-cruiser').IConfiguration} */
const config = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "A cycle makes the layers impossible to reason about.",
      from: {},
      to: { circular: true },
    },
    {
      name: "core-imports-only-core",
      severity: "error",
      comment: "Dependencies point inward: core is the centre of the application.",
      from: { path: "^src/core" },
      to: { path: "^src/(app|components|features|infrastructure|integrations|lib)" },
    },
    {
      name: "core-uses-only-pure-packages",
      severity: "error",
      comment: "core stays free of frameworks and I/O; stopword is a pure word list.",
      from: { path: "^src/core" },
      to: { dependencyTypes: ["npm"], pathNot: "/(zod|stopword)/" },
    },
    {
      name: "lib-imports-only-itself",
      severity: "error",
      comment: "lib is a leaf shared by every layer.",
      from: { path: "^src/lib" },
      to: { path: "^src/(app|components|core|features|infrastructure|integrations)" },
    },
    {
      name: "lib-uses-no-framework",
      severity: "error",
      comment: "lib holds framework-free helpers; cn and zod are the only packages it may use.",
      from: { path: "^src/lib" },
      to: { dependencyTypes: ["npm"], pathNot: "/(cn|zod)/" },
    },
    {
      name: "core-and-lib-avoid-node-io",
      severity: "error",
      comment: "Filesystem, crypto and process I/O belong in infrastructure or an integration.",
      from: { path: "^src/(core|lib)" },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "infrastructure-stays-below-features",
      severity: "error",
      from: { path: "^src/infrastructure" },
      to: { path: "^src/(app|components|features|integrations)" },
    },
    {
      name: "integrations-implement-core",
      severity: "error",
      from: { path: "^src/integrations" },
      to: { path: "^src/(app|components|features)" },
    },
    {
      name: "features-stay-out-of-the-ui",
      severity: "error",
      from: { path: "^src/features" },
      to: { path: "^src/(app|components)" },
    },
    {
      name: "components-render-features",
      severity: "error",
      comment: "Components may reach infrastructure only through the browser auth client.",
      from: { path: "^src/components" },
      to: { path: "^src/(app|integrations)" },
    },
    {
      name: "components-use-only-the-browser-client",
      severity: "error",
      from: { path: "^src/components" },
      to: { path: "^src/infrastructure", pathNot: "^src/infrastructure/auth/client" },
    },
    {
      name: "app-wires-features",
      severity: "error",
      comment: "Adapters stay behind features; a page never reaches for a provider.",
      from: { path: "^src/app" },
      to: { path: "^src/integrations" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(\\.next|coverage|tests/fixtures)/" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "require", "node", "default"] },
  },
};

module.exports = config;
