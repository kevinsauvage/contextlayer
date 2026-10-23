import type { Evidence } from "@/core/evidence/schemas";
import { Badge } from "@/components/ui/badge";

export function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  if (!evidence.length) return <p className="text-sm text-muted-foreground">No evidence was cited.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {evidence.map((item) => (
        <li key={item.id} className="rounded-lg border p-3 text-sm">
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
