// Secrets are masked before text reaches a model or a stored excerpt. The patterns cover tokens with a recognizable
// shape and key/value assignments, and every replacement keeps the line structure so a citation still points at the
// same lines.
const PRIVATE_KEY = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g;
const TOKEN_SHAPES = [
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
];
// The password in a connection string: `postgres://user:hunter22@host/db`.
const URL_PASSWORD = /\b([a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:)[^\s@/]+@/gi;
// A bearer token carries a digit; "Bearer authentication" in prose does not.
const BEARER = /\b(Bearer[^\S\n]+)(?=[A-Za-z0-9._~+/=-]*\d)[A-Za-z0-9._~+/=-]{16,}/gi;
// A key named like a credential assigned one value: `POSTGRES_PASSWORD: hunter2`, `"apiKey": "abc123"`,
// `password = "my pass-word 1"`. Whitespace never crosses a line: a match that swallowed the blank lines after it
// would shift every later citation.
const ASSIGNMENT =
  /^([^\S\n]*(?:(?:const|let|var|export\s+const)\s+)?["']?[A-Za-z0-9_.-]*(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)[A-Za-z0-9_.-]*["']?[^\S\n]*[:=][^\S\n]*)(?:(["'])([^"'\n]{6,})\2|(\S{6,}?))[^\S\n]*[,;]?[^\S\n]*$/gim;

// An unquoted value that is code, not a credential: a call, a member access, a type or a variable reference. Masking
// these would hide the lines an auth ticket has to cite.
// A dotted value with a digit in it (`sk.live.abc123`) is more likely a key than a property path, so it is masked.
const MEMBER_ACCESS = /^[A-Za-z_$][A-Za-z_$]{0,39}(?:\??\.[A-Za-z_$][A-Za-z_$]{0,39})+$/;
const TYPE_OR_KEYWORD = /^(?:string|number|boolean|unknown|undefined|never|object|symbol|bigint)(?:\[\])?$/;
const VARIABLE_REFERENCE = /^\$(?:\{[^}]+\}|[A-Za-z_][A-Za-z0-9_]*)$/;
const isExpression = (value: string) =>
  value.includes("(") || MEMBER_ACCESS.test(value) || TYPE_OR_KEYWORD.test(value) || VARIABLE_REFERENCE.test(value);

// Interface copy sits under keys such as `forgotPassword`: several plain words are a label, not a credential.
const isProse = (value: string) => /\s/.test(value) && /^[\p{L}\s.,!?:;'’…-]+$/u.test(value);

const maskAssignment = (match: string, key: string, _quote: string | undefined, quoted?: string, bare?: string) => {
  if (quoted !== undefined) return isProse(quoted) ? match : `${key}[redacted]`;
  return bare === undefined || isExpression(bare) ? match : `${key}[redacted]`;
};

export function redactSecrets(text: string): string {
  const masked = text
    .replace(PRIVATE_KEY, (block) => block.replace(/[^\n]+/g, "[redacted private key]"))
    .replace(URL_PASSWORD, "$1[redacted]@")
    .replace(BEARER, "$1[redacted]")
    .replace(ASSIGNMENT, maskAssignment);
  return TOKEN_SHAPES.reduce((value, pattern) => value.replace(pattern, "[redacted]"), masked);
}
