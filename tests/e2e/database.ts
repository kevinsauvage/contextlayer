// A database of its own, recreated on every run, in the same Postgres as `pnpm db:up`.
const DEFAULT_DATABASE_URL = "postgres://contextlayer:contextlayer@localhost:5434/contextlayer_e2e";

export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? DEFAULT_DATABASE_URL;

// `tests/e2e/global-setup.ts` drops this database before creating it. Pointing E2E_DATABASE_URL at the development
// database would erase it, so only a name the suite owns is accepted.
export function assertE2eDatabase(url: string): void {
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith("_e2e"))
    throw new Error(
      `Refusing to drop "${name}": E2E_DATABASE_URL must name a database ending in "_e2e" ` +
        `(the default is ${new URL(DEFAULT_DATABASE_URL).pathname.slice(1)}).`,
    );
}
