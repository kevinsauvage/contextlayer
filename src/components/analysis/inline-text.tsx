import { inlineSpans } from "@/core/requirements/render";

export function InlineText({ children }: { children: string }) {
  return inlineSpans(children).map((span, i) =>
    span.code ? (
      <code key={i} className="rounded bg-muted px-1 py-px font-mono text-[0.85em] break-words">
        {span.text}
      </code>
    ) : (
      span.text
    ),
  );
}
