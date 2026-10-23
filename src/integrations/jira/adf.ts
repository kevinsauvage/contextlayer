import { CLAIM_STATUS_LABELS } from "@/core/evidence/schemas";
import type { Bullet, TicketSection } from "@/core/requirements/render";

type AdfNode = { type: string; text?: string; content?: AdfNode[]; attrs?: Record<string, unknown>; marks?: unknown[] };

const paragraph = (content: AdfNode[]): AdfNode => ({ type: "paragraph", content });
const text = (value: string, url?: string): AdfNode => ({
  type: "text",
  text: value,
  ...(url ? { marks: [{ type: "link", attrs: { href: url } }] } : {}),
});

// Jira has no status pills, so unverified claims carry their status as a text prefix.
const plainText = (bullet: Bullet) =>
  bullet.status && bullet.status !== "verified" ? `${CLAIM_STATUS_LABELS[bullet.status]}: ${bullet.text}` : bullet.text;

const bulletItem = (bullet: Bullet): AdfNode => ({
  type: "listItem",
  content: [paragraph([text(plainText(bullet), bullet.url)])],
});

export function sectionsToAdf(sections: TicketSection[]) {
  const content: AdfNode[] = sections.flatMap((section) => [
    ...(section.heading ? [{ type: "heading", attrs: { level: 3 }, content: [text(section.heading)] }] : []),
    ...(section.paragraphs ?? []).map((p) => paragraph([text(plainText(p), p.url)])),
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
