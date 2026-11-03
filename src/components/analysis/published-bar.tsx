import { CircleCheck, ExternalLink } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

type Props = {
  trackerName: string;
  issueKey: string | null;
  issueUrl: string | null;
  // The audited issue, when the draft updated an existing ticket.
  existingKey?: string;
  // Offers "Draft another ticket" in this project.
  projectId?: string;
};

// The bar shown once a ticket exists in the tracker: it says where it landed and what can follow.
export function PublishedBar({ trackerName, issueKey, issueUrl, existingKey, projectId }: Props) {
  return (
    <div
      role="status"
      className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur"
    >
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <CircleCheck aria-hidden className="size-4 shrink-0 text-success" />
        {existingKey ? "Updated" : "Created"} {issueKey ?? "the issue"} in {trackerName}
      </p>
      <div className="flex flex-wrap gap-2">
        {projectId && (
          <Link href={`/projects/${projectId}#request`} className={buttonVariants({ variant: "outline" })}>
            Draft another ticket
          </Link>
        )}
        <a href={issueUrl ?? undefined} target="_blank" rel="noreferrer" className={buttonVariants()}>
          Open {issueKey ?? "issue"} <ExternalLink aria-hidden />
        </a>
      </div>
    </div>
  );
}
