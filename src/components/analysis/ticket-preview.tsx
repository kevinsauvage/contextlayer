import { CircleCheck, SquareKanban } from "lucide-react";
import {
  CLAIM_STATUSES,
  CLAIM_STATUS_DESCRIPTIONS,
  CLAIM_STATUS_LABELS,
  type ClaimStatus,
  type Evidence,
} from "@/core/evidence/schemas";
import type { TicketDraft } from "@/core/requirements/schemas";
import { InlineText } from "@/components/analysis/inline-text";
import { OPEN_QUESTIONS_ANCHOR } from "@/components/analysis/open-questions";
import { ticketSections, type Bullet } from "@/core/requirements/render";
import { cn } from "@/lib/utils";

const PILL: Record<Exclude<ClaimStatus, "verified">, string> = {
  inferred: "bg-info/12 text-info",
  unknown: "bg-muted text-muted-foreground",
  needs_clarification: "bg-warning/14 text-warning",
};

const MARKER: Record<ClaimStatus, string> = {
  verified: "bg-success",
  inferred: "bg-info",
  unknown: "bg-muted-foreground/50",
  needs_clarification: "bg-warning",
};

const evidenceAnchor = (id: string) => `evidence-${id}`;

type EvidenceById = Map<string, Evidence>;

function StatusMark({ status }: { status?: ClaimStatus }) {
  if (!status) return null;
  if (status === "verified")
    return (
      <>
        <CircleCheck aria-hidden className="mr-1 inline size-3.5 -translate-y-px text-success" />
        <span className="sr-only">Verified: </span>
      </>
    );
  return (
    <span className={cn("mr-1.5 rounded px-1.5 py-0.5 text-xs font-medium", PILL[status])}>
      {CLAIM_STATUS_LABELS[status]}
      <span className="sr-only">: </span>
    </span>
  );
}

function Citations({ ids, evidence }: { ids?: string[]; evidence: EvidenceById }) {
  if (!ids?.length) return null;
  return (
    <span className="ml-1 inline-flex gap-1 align-[0.08em]">
      {ids.map((id) => {
        const source = evidence.get(id);
        return (
          <a
            key={id}
            href={`#${evidenceAnchor(id)}`}
            title={source?.reference}
            aria-label={`Evidence ${id}${source ? `: ${source.reference}` : ""}`}
            className="rounded bg-brand/8 px-1 font-mono text-[0.7rem] leading-4 text-brand no-underline transition-colors hover:bg-brand/15"
          >
            {id}
          </a>
        );
      })}
    </span>
  );
}

const QuestionsLink = ({ children }: { children: string }) => (
  <a
    href={`#${OPEN_QUESTIONS_ANCHOR}`}
    className="ml-1.5 text-xs font-medium whitespace-nowrap text-brand underline-offset-2 hover:underline"
  >
    {children}
  </a>
);

type ClaimTextProps = { item: Bullet; evidence: EvidenceById; questionsAnchored: boolean };

function ClaimText({ item, evidence, questionsAnchored }: ClaimTextProps) {
  const needsDecision = item.needsDecision ?? item.status === "needs_clarification";
  return (
    <>
      <StatusMark status={item.status} />
      <InlineText>{item.text}</InlineText>
      <Citations ids={item.evidenceIds} evidence={evidence} />
      {questionsAnchored && needsDecision && <QuestionsLink>See open questions</QuestionsLink>}
    </>
  );
}

function EvidenceSource({ bullet, source }: { bullet: Bullet; source?: Evidence }) {
  return (
    <li
      id={bullet.evidenceId && evidenceAnchor(bullet.evidenceId)}
      className="-mx-2 scroll-mt-24 rounded-md px-2 py-1 transition-colors target:bg-brand/6 target:ring-1 target:ring-brand/20"
    >
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="shrink-0 rounded bg-brand/8 px-1 font-mono text-[0.7rem] leading-4 text-brand">
          {bullet.evidenceId}
        </span>
        {bullet.url ? (
          <a
            href={bullet.url}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 font-mono text-xs break-all underline-offset-2 hover:underline"
          >
            {bullet.text}
          </a>
        ) : (
          <span className="min-w-0 font-mono text-xs break-all">{bullet.text}</span>
        )}
      </div>
      {source && (
        <details className="mt-1 text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Show excerpt</summary>
          <pre className="mt-1.5 overflow-x-auto rounded bg-muted p-2 whitespace-pre-wrap">{source.excerpt}</pre>
        </details>
      )}
    </li>
  );
}

type Props = {
  draft: TicketDraft;
  trackerName: string;
  projectLabel: string;
  issueKey: string | null;
  statusLabel: string;
  questionsAnchored: boolean;
};

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ClaimSummary({ draft }: { draft: TicketDraft }) {
  const claims = [...draft.description, ...draft.acceptanceCriteria];
  const counts = CLAIM_STATUSES.map((status) => ({
    status,
    count: claims.filter((claim) => claim.status === status).length,
  })).filter(({ count }) => count > 0);
  return (
    <ul className="flex flex-col gap-2">
      {counts.map(({ status, count }) => (
        <li key={status} className="flex flex-col">
          <span className="flex items-center gap-2">
            <span aria-hidden className={cn("size-2 rounded-full", MARKER[status])} />
            <span className="font-medium">{CLAIM_STATUS_LABELS[status]}</span>
            <span className="ml-auto text-muted-foreground tabular-nums">{count}</span>
          </span>
          <span className="pl-4 text-xs text-muted-foreground">{CLAIM_STATUS_DESCRIPTIONS[status]}</span>
        </li>
      ))}
    </ul>
  );
}

export function TicketPreview({ draft, trackerName, projectLabel, issueKey, statusLabel, questionsAnchored }: Props) {
  const sections = ticketSections(draft);
  const evidence: EvidenceById = new Map(draft.evidence.map((item) => [item.id, item]));
  return (
    <article
      className="overflow-hidden rounded-xl bg-card shadow-surface ring-1 ring-foreground/8"
      aria-label={`${trackerName} preview`}
    >
      <header className="flex flex-col gap-2 border-b px-5 py-4">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <SquareKanban aria-hidden className="size-3.5" />
          {projectLabel} / <span className="font-medium text-foreground">{issueKey ?? "New issue"}</span>
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-balance">
          <InlineText>{draft.title}</InlineText>
        </h2>
      </header>
      <div className="grid gap-6 px-5 py-5 md:grid-cols-[1fr_13rem]">
        <div className="flex min-w-0 flex-col gap-5 text-sm leading-relaxed">
          {sections.map((section, index) => (
            <section key={section.heading ?? index} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold">{section.heading ?? "Description"}</h3>
                {questionsAnchored && section.openQuestions && <QuestionsLink>Answer these above</QuestionsLink>}
              </div>
              {section.paragraphs?.map((paragraph, i) => (
                <p key={i}>
                  <ClaimText item={paragraph} evidence={evidence} questionsAnchored={questionsAnchored} />
                </p>
              ))}
              {section.bullets?.[0]?.evidenceId ? (
                <ul className="flex flex-col gap-1">
                  {section.bullets.map((bullet) => (
                    <EvidenceSource
                      key={bullet.evidenceId}
                      bullet={bullet}
                      source={bullet.evidenceId ? evidence.get(bullet.evidenceId) : undefined}
                    />
                  ))}
                </ul>
              ) : (
                section.bullets && (
                  <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-muted-foreground">
                    {section.bullets.map((bullet, i) => (
                      <li key={i}>
                        <ClaimText item={bullet} evidence={evidence} questionsAnchored={questionsAnchored} />
                      </li>
                    ))}
                  </ul>
                )
              )}
            </section>
          ))}
        </div>
        <dl className="flex h-fit flex-col gap-4 border-t pt-5 text-sm md:sticky md:top-20 md:border-t-0 md:border-l md:pt-0 md:pl-5">
          <Detail label="Status">
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium uppercase">{statusLabel}</span>
          </Detail>
          <Detail label="Claims">
            <ClaimSummary draft={draft} />
          </Detail>
          <Detail label="Open questions">
            <span className="tabular-nums">{draft.openQuestions.length}</span>
          </Detail>
        </dl>
      </div>
    </article>
  );
}
