export const MAX_FILE_BYTES = 100_000;
const MAX_SEARCH_TERMS = 3;
export const SEARCH_RESULTS = 20;

const TEXT_EXTENSIONS =
  /\.(ts|tsx|js|jsx|mjs|cjs|json|md|mdx|css|scss|sql|ya?ml|py|rb|go|java|kt|php|cs|rs|html|vue|svelte)$/i;
const IGNORED_PATH =
  /(^|\/)(node_modules|dist|build|\.next|vendor|coverage)\/|(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$|\.min\./;
// Files that usually hold credentials, not code: the agent must not read them, so no excerpt can store or quote one.
const SECRET_PATH =
  /(?:^|\/)(?:\.env[^/]*|\.npmrc|[^/]*(?:secret|credential)[^/]*|[^/]*\.(?:pem|key)|id_rsa[^/]*|[^/]*\.tfvars|service-account[^/]*\.json|appsettings[^/]*\.json)$/i;

export const isReadablePath = (path: string) =>
  TEXT_EXTENSIONS.test(path) && !IGNORED_PATH.test(path) && !SECRET_PATH.test(path);

// A directory the walk must not descend into: `node_modules/`, `dist/`, `vendor/` and their siblings.
const IGNORED_DIRECTORY = /(^|\/)(node_modules|dist|build|\.next|vendor|coverage)(\/|$)/;
export const isIgnoredPath = (path: string) => IGNORED_DIRECTORY.test(path);

// A bare number or a hex colour names a value, not an identifier a text search can find.
export const searchableTerms = (terms: string[]) =>
  terms.filter((term) => !/^\d+$/.test(term) && !/^(?=.*\d)[0-9a-f]{3,8}$/i.test(term)).slice(0, MAX_SEARCH_TERMS);

// What the source will not search: past the cap, or not an identifier. Reported apart so the agent does not read a
// term it never searched as "no file contains it".
export const skippedTerms = (terms: string[]) => {
  const searchable = searchableTerms(terms);
  return terms.filter((term) => !searchable.includes(term));
};
