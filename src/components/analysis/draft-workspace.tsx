"use client";

import { CircleAlert, CircleCheck, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DraftEditor } from "@/components/analysis/draft-editor";
import { useOptionalRefinement } from "@/components/analysis/refinement-context";
import { TicketPreview } from "@/components/analysis/ticket-preview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation } from "@/components/use-mutation";
import { withoutIncompleteItems, type TicketDraft } from "@/core/requirements/schemas";
import type { PublishResult } from "@/features/analysis/publish";
import type { ActionState } from "@/lib/action-state";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function readinessOf(draft: TicketDraft, unappliedAnswers: number) {
  const claims = [...draft.description, ...draft.acceptanceCriteria];
  const withStatus = (status: string) => claims.filter((claim) => claim.status === status).length;
  const unresolved = [
    draft.openQuestions.length && count(draft.openQuestions.length, "open question", "open questions"),
    withStatus("needs_clarification") &&
      count(withStatus("needs_clarification"), "claim needs clarification", "claims need clarification"),
    unappliedAnswers && count(unappliedAnswers, "answer not applied yet", "answers not applied yet"),
  ].filter((item): item is string => Boolean(item));
  const labelled = withStatus("inferred") + withStatus("unknown");
  return { unresolved, labelled };
}

function useWarnBeforeLeaving(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);
}

type Props = {
  initial: TicketDraft;
  publish: (draft: TicketDraft) => Promise<PublishResult>;
  publishLabel: string;
  trackerName: string;
  projectLabel: string;
  // The audited issue, when the draft updates an existing ticket.
  existingKey?: string;
  // Offers "Draft another ticket" in this project once published.
  projectId?: string;
  // Persists manual edits; omitted for audits, which do not autosave.
  save?: (draft: TicketDraft) => Promise<ActionState>;
  published: { key: string | null; url: string | null };
  // True when the open questions are answered in a block above the preview.
  questionsAnchored?: boolean;
};

export function DraftWorkspace({
  initial,
  publish,
  publishLabel,
  trackerName,
  projectLabel,
  existingKey,
  projectId,
  save,
  published: initialPublished,
  questionsAnchored = false,
}: Props) {
  const [draft, setDraft] = useState(initial);
  const [result, setResult] = useState<PublishResult>(
    initialPublished.url ? { issueUrl: initialPublished.url, issueKey: initialPublished.key ?? undefined } : {},
  );
  const { run, pending } = useMutation();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const published = Boolean(result.issueUrl);
  const refinement = useOptionalRefinement();
  const edited = !published && JSON.stringify(draft) !== JSON.stringify(initial);
  const setDraftEdited = refinement?.setDraftEdited;
  const unappliedAnswers = refinement?.answered.length ?? 0;
  const { unresolved, labelled } = readinessOf(draft, unappliedAnswers);
  const target = existingKey ? `Updates ${existingKey}` : `Creates a new issue in ${projectLabel}`;

  useEffect(() => setDraftEdited?.(edited), [edited, setDraftEdited]);
  useWarnBeforeLeaving(edited);

  const [saveStatus, setSaveStatus] = useState<{ saved: boolean; error?: string }>({ saved: false });
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);
  useEffect(() => {
    if (!edited || !saveRef.current) return;
    const timer = setTimeout(() => {
      void saveRef.current?.(withoutIncompleteItems(draft)).then(
        (outcome) => setSaveStatus({ saved: !outcome.error, error: outcome.error }),
        () => setSaveStatus({ saved: false, error: "Could not reach the server" }),
      );
    }, 800);
    return () => clearTimeout(timer);
  }, [draft, edited, published]);

  const approve = () => {
    setConfirming(false);
    run(async () => {
      const outcome = await publish(draft);
      setResult(outcome);
      // The conversation and open questions are server-rendered; refresh them to their published state.
      if (outcome.issueUrl) router.refresh();
      return {};
    });
  };
  return (
    <div className="flex flex-col gap-4">
      <Tabs defaultValue="preview" className="gap-4">
        <TabsList>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="edit" disabled={published}>
            Edit
          </TabsTrigger>
        </TabsList>
        {published && <p className="text-xs text-muted-foreground">Published tickets are edited in {trackerName}.</p>}
        {edited && save && (
          <p className={saveStatus.error ? "text-xs text-destructive" : "text-xs text-muted-foreground"} role="status">
            {saveStatus.error ? `Not saved: ${saveStatus.error}` : saveStatus.saved ? "Saved" : "Saving soon…"}
          </p>
        )}
        <TabsContent value="preview">
          <TicketPreview
            draft={draft}
            trackerName={trackerName}
            projectLabel={projectLabel}
            issueKey={result.issueKey ?? existingKey ?? null}
            statusLabel={published ? (existingKey ? "Updated" : "Created") : existingKey ? "Existing" : "To do"}
            questionsAnchored={questionsAnchored && !published}
          />
        </TabsContent>
        <TabsContent value="edit">
          <DraftEditor
            draft={draft}
            onChange={setDraft}
            disabled={published}
            trackerName={trackerName}
            questionsAnchored={questionsAnchored}
          />
        </TabsContent>
      </Tabs>

      {result.error && (
        <Alert variant="destructive">
          <AlertTitle>{published ? "Published with a problem" : "Could not publish"}</AlertTitle>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      )}
      {published ? (
        <div
          role="status"
          className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur"
        >
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <CircleCheck aria-hidden className="size-4 shrink-0 text-success" />
            {existingKey ? "Updated" : "Created"} {result.issueKey ?? "the issue"} in {trackerName}
          </p>
          <div className="flex flex-wrap gap-2">
            {projectId && (
              <Link href={`/projects/${projectId}#request`} className={buttonVariants({ variant: "outline" })}>
                Draft another ticket
              </Link>
            )}
            <a href={result.issueUrl} target="_blank" rel="noreferrer" className={buttonVariants()}>
              Open {result.issueKey ?? "issue"} <ExternalLink aria-hidden />
            </a>
          </div>
        </div>
      ) : (
        <div
          className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur"
          aria-label="Approval"
          role="region"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5 text-sm">
              {unresolved.length ? (
                <p className="flex items-center gap-1.5 font-medium">
                  <CircleAlert aria-hidden className="size-4 shrink-0 text-warning" />
                  {unresolved.join(" · ")}
                </p>
              ) : (
                <p className="flex items-center gap-1.5 font-medium">
                  <CircleCheck aria-hidden className="size-4 shrink-0 text-success" />
                  Nothing left to decide
                </p>
              )}
              <p className="text-muted-foreground">
                {target}
                {labelled > 0 && ` with ${count(labelled, "labelled claim", "labelled claims")}`}. Nothing is sent to{" "}
                {trackerName} until you approve.
              </p>
            </div>
            {!confirming && (
              <Button disabled={pending} onClick={() => (unresolved.length ? setConfirming(true) : approve())}>
                {pending ? "Publishing…" : publishLabel}
              </Button>
            )}
          </div>
          {confirming && (
            <div role="alert" className="flex flex-col gap-2 rounded-lg bg-warning/10 p-3 text-sm">
              <p>
                <span className="font-medium">Still unresolved: {unresolved.join(" · ")}.</span> Open questions and
                claims that need clarification are published labelled in {trackerName}.
                {unappliedAnswers > 0 && " Answers you have not applied are not included."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={approve}>
                  Publish anyway
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(false)}>
                  Keep editing
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
