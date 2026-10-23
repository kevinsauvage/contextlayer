import { SquareKanban } from "lucide-react";
import { CLAIM_STATUS_LABELS, type ClaimStatus } from "@/core/evidence/schemas";
import type { TicketDraft } from "@/core/requirements/schemas";
import { ticketSections, type Bullet } from "@/core/requirements/render";
import { cn } from "@/lib/utils";

// Mirrors render.ts: verified claims carry no pill because they need no caveat.
const PILL: Record<Exclude<ClaimStatus, "verified">, string> = {
  inferred: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  unknown: "bg-muted text-muted-foreground",
  needs_clarification: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
};

const pillOf = (status?: ClaimStatus) => (status && status !== "verified" ? status : undefined);

function ClaimText({ item }: { item: Bullet }) {
  const pill = pillOf(item.status);
  return (
    <>
      {pill && (
        <span className={cn("mr-1.5 rounded px-1.5 py-0.5 text-xs font-medium", PILL[pill])}>
          {CLAIM_STATUS_LABELS[pill]}
        </span>
      )}
      {item.text}
    </>
  );
}

const BulletItem = ({ bullet }: { bullet: Bullet }) =>
  bullet.url ? (
    <a
      href={bullet.url}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-xs text-primary underline-offset-2 hover:underline"
    >
      {bullet.text}
    </a>
  ) : (
    <ClaimText item={bullet} />
  );

type Props = {
  draft: TicketDraft;
  trackerName: string;
  projectLabel: string;
  issueKey: string | null;
};

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function TicketPreview({ draft, trackerName, projectLabel, issueKey }: Props) {
  const sections = ticketSections(draft);
  return (
    <article
      className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
      aria-label={`${trackerName} preview`}
    >
      <header className="flex flex-col gap-2 border-b px-5 py-4">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <SquareKanban aria-hidden className="size-3.5" />
          {projectLabel} / <span className="font-medium text-foreground">{issueKey ?? "New issue"}</span>
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-balance">{draft.title}</h2>
      </header>
      <div className="grid gap-6 px-5 py-5 md:grid-cols-[1fr_12rem]">
        <div className="flex min-w-0 flex-col gap-5 text-sm leading-relaxed">
          {sections.map((section, index) => (
            <section key={section.heading ?? index} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{section.heading ?? "Description"}</h3>
              {section.paragraphs?.map((paragraph, i) => (
                <p key={i}>
                  <ClaimText item={paragraph} />
                </p>
              ))}
              {section.bullets && (
                <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-muted-foreground">
                  {section.bullets.map((bullet, i) => (
                    <li key={i}>
                      <BulletItem bullet={bullet} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
        <dl className="flex h-fit flex-col gap-3 rounded-lg border p-3 text-sm">
          <Detail label="Status">
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium uppercase">
              {issueKey ? "Existing" : "To do"}
            </span>
          </Detail>
          <Detail label="Acceptance criteria">{draft.acceptanceCriteria.length}</Detail>
          <Detail label="Evidence">{draft.evidence.length} sources</Detail>
          <Detail label="Open questions">{draft.openQuestions.length}</Detail>
        </dl>
      </div>
    </article>
  );
}
