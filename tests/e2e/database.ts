// A database of its own, recreated on every run, in the same Postgres as `pnpm db:up`.
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgres://contextlayer:contextlayer@localhost:5434/contextlayer_e2e";
