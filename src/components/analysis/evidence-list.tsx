import type { Evidence } from "@/core/evidence/schemas";
import { Badge } from "@/components/ui/badge";

// A page can list the same evidence IDs twice (an audit's findings and its proposed ticket), so each list can scope its anchors.
export const evidenceAnchor = (id: string, scope?: string) => (scope ? `${scope}-evidence-${id}` : `evidence-${id}`);

export function EvidenceLink({ id, source, scope }: { id: string; source?: Evidence; scope?: string }) {
  return (
    <a
      href={`#${evidenceAnchor(id, scope)}`}
      title={source?.reference}
      aria-label={`Evidence ${id}${source ? `: ${source.reference}` : ""}`}
      className="rounded bg-brand/8 px-1 font-mono text-[0.7rem] leading-4 text-brand no-underline transition-colors hover:bg-brand/15"
    >
      {id}
    </a>
  );
}

export function EvidenceList({ evidence, anchorScope }: { evidence: Evidence[]; anchorScope?: string }) {
  if (!evidence.length) return <p className="text-sm text-muted-foreground">No evidence was cited.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {evidence.map((item) => (
        <li
          key={item.id}
          id={evidenceAnchor(item.id, anchorScope)}
          className="scroll-mt-24 rounded-lg border p-3 text-sm target:ring-2 target:ring-brand/30"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{item.id}</Badge>
            <span className="text-muted-foreground">{item.kind.replace("_", " ")}</span>
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline-offset-2 hover:underline"
              >
                {item.reference}
                {item.lines && `:${item.lines.start}-${item.lines.end}`}
              </a>
            ) : (
              <span className="font-medium">{item.reference}</span>
            )}
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer text-muted-foreground">Excerpt</summary>
            <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">{item.excerpt}</pre>
          </details>
        </li>
      ))}
    </ul>
  );
}
