import { CLAIM_STATUS_LABELS } from "@/core/evidence/schemas";
import { inlineSpans, type Bullet, type TicketSection } from "@/core/requirements/render";

type AdfNode = { type: string; text?: string; content?: AdfNode[]; attrs?: Record<string, unknown>; marks?: unknown[] };

const paragraph = (content: AdfNode[]): AdfNode => ({ type: "paragraph", content });
const text = (value: string, url?: string): AdfNode => ({
  type: "text",
  text: value,
  ...(url ? { marks: [{ type: "link", attrs: { href: url } }] } : {}),
});

const code = (value: string): AdfNode => ({ type: "text", text: value, marks: [{ type: "code" }] });

// Jira has no status pills, so unverified claims carry their status as a text prefix and citations as [e1] markers.
function inlineNodes(bullet: Bullet): AdfNode[] {
  const status = bullet.status && bullet.status !== "verified" ? `${CLAIM_STATUS_LABELS[bullet.status]}: ` : "";
  const source = bullet.evidenceId ? `[${bullet.evidenceId}] ` : "";
  const citations = bullet.evidenceIds?.length ? ` [${bullet.evidenceIds.join(", ")}]` : "";
  const body = bullet.url
    ? [text(bullet.text, bullet.url)]
    : inlineSpans(bullet.text).map((span) => (span.code ? code(span.text) : text(span.text)));
  return [...(source + status ? [text(source + status)] : []), ...body, ...(citations ? [text(citations)] : [])];
}

const bulletItem = (bullet: Bullet): AdfNode => ({
  type: "listItem",
  content: [paragraph(inlineNodes(bullet))],
});

export function sectionsToAdf(sections: TicketSection[]) {
  const content: AdfNode[] = sections.flatMap((section) => [
    ...(section.heading ? [{ type: "heading", attrs: { level: 3 }, content: [text(section.heading)] }] : []),
    ...(section.paragraphs ?? []).map((p) => paragraph(inlineNodes(p))),
    ...(section.bullets?.length ? [{ type: "bulletList", content: section.bullets.map(bulletItem) }] : []),
  ]);
  return { type: "doc", version: 1, content };
}

const BLOCK_TYPES = new Set(["paragraph", "heading", "codeBlock", "blockquote"]);

export function adfToText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const { type, text: value, content, attrs } = node as AdfNode;
  if (type === "text") return value ?? "";
  if (type === "hardBreak") return "\n";
  if (type === "inlineCard") return typeof attrs?.url === "string" ? attrs.url : "";
  const inner = (content ?? []).map(adfToText).join("");
  if (type === "listItem") return `- ${inner.trim()}\n`;
  return type && BLOCK_TYPES.has(type) ? `${inner}\n` : inner;
}
