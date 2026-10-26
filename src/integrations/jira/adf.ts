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

const BLOCK_TYPES = new Set(["paragraph", "heading", "blockquote", "panel"]);
const LINK_TYPES = new Set(["inlineCard", "blockCard", "embedCard"]);

const attributeText = (attrs: AdfNode["attrs"], ...keys: string[]) => {
  for (const key of keys) {
    const value = attrs?.[key];
    if (typeof value === "string" && value) return value;
  }
  return "";
};

const dateOf = (attrs: AdfNode["attrs"]) => {
  const stamp = Number(attrs?.timestamp);
  return Number.isFinite(stamp) && stamp > 0 ? new Date(stamp).toISOString().slice(0, 10) : "";
};

const children = (node: AdfNode) => node.content ?? [];
const itemText = (item: AdfNode) => children(item).map(adfToText).join("").trim();

export function adfToText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const adf = node as AdfNode;
  const { type, text: value, attrs } = adf;
  switch (type) {
    case "text":
      return value ?? "";
    case "hardBreak":
      return "\n";
    case "mention":
    case "status":
      return attributeText(attrs, "text");
    case "emoji":
      return attributeText(attrs, "text", "shortName");
    case "date":
      return dateOf(attrs);
    case "inlineCard":
    case "blockCard":
    case "embedCard":
      return attributeText(attrs, "url");
    case "codeBlock":
      return `\`\`\`\n${children(adf).map(adfToText).join("")}\n\`\`\`\n`;
    case "bulletList":
      return children(adf)
        .map((item) => `- ${itemText(item)}\n`)
        .join("");
    case "orderedList":
      return children(adf)
        .map((item, index) => `${index + 1}. ${itemText(item)}\n`)
        .join("");
    case "tableRow":
      return `${children(adf)
        .map((cell) => adfToText(cell).trim().replace(/\n+/g, " "))
        .join(" | ")}\n`;
    default: {
      const inner = children(adf).map(adfToText).join("");
      if (type === "listItem") return `- ${inner.trim()}\n`;
      return type && (BLOCK_TYPES.has(type) || LINK_TYPES.has(type)) ? `${inner}\n` : inner;
    }
  }
}
