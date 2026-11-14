// Secrets are masked before text reaches a model or a stored excerpt. The patterns cover tokens with a recognizable
// shape and key/value assignments, and every replacement keeps the line structure so a citation still points at the
// same lines.
const PRIVATE_KEY = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g;
const TOKEN_SHAPES = [
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
];
// A key named like a credential assigned a single opaque value: `POSTGRES_PASSWORD: hunter2`, `"apiKey": "abc123"`.
const ASSIGNMENT =
  /^(\s*(?:(?:const|let|var|export\s+const)\s+)?["']?[A-Za-z0-9_.-]*(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)[A-Za-z0-9_.-]*["']?\s*[:=]\s*)(["']?)(\S{6,})\2\s*[,;]?\s*$/gim;

export function redactSecrets(text: string): string {
  const masked = text
    .replace(PRIVATE_KEY, (block) => block.replace(/[^\n]+/g, "[redacted private key]"))
    .replace(ASSIGNMENT, "$1[redacted]");
  return TOKEN_SHAPES.reduce((value, pattern) => value.replace(pattern, "[redacted]"), masked);
}
