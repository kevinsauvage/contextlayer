"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApprovalBar } from "@/components/analysis/approval-bar";
import { DraftEditor } from "@/components/analysis/draft-editor";
import { EvidenceWarnings } from "@/components/analysis/evidence-warnings";
import { PublishedBar } from "@/components/analysis/published-bar";
import { readinessLabels } from "@/components/analysis/readiness-labels";
import { useOptionalRefinement } from "@/components/analysis/refinement-context";
import { TicketPreview } from "@/components/analysis/ticket-preview";
import { useAutosave } from "@/components/analysis/use-autosave";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation } from "@/components/use-mutation";
import type { Evidence } from "@/core/evidence/schemas";
import { draftIssues, isBlockingIssue, isClaimPath, type EvidenceIssue } from "@/core/evidence/validate";
import { draftReadiness } from "@/core/requirements/readiness";
import type { TicketDraft } from "@/core/requirements/schemas";
import type { PublishResult } from "@/features/analysis/publish";
import type { ActionState } from "@/lib/action-state";
import { countLabel } from "@/lib/count";

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
  // Claims whose quotes the evidence does not support; approval is blocked until they are fixed.
  issues?: EvidenceIssue[];
  // Every source the analysis stored. With it, the warnings are checked again as the draft is edited.
  evidence?: Evidence[];
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
  issues = [],
  evidence,
}: Props) {
  const [draft, setDraft] = useState(initial);
  const [result, setResult] = useState<PublishResult>(
    initialPublished.url ? { issueUrl: initialPublished.url, issueKey: initialPublished.key ?? undefined } : {},
  );
  const { run, pending } = useMutation();
  const router = useRouter();
  const [tab, setTab] = useState("preview");
  const [highlight, setHighlight] = useState<"description" | "acceptanceCriteria" | null>(null);
  const published = Boolean(result.issueUrl);
  const refinement = useOptionalRefinement();
  const updating = refinement?.updating ?? false;
  const edited = !published && JSON.stringify(draft) !== JSON.stringify(initial);
  const setDraftEdited = refinement?.setDraftEdited;
  const unappliedAnswers = refinement?.answered.length ?? 0;
  const readiness = draftReadiness(draft);
  const pendingReasons = [
    ...readinessLabels(readiness),
    ...(unappliedAnswers ? [countLabel(unappliedAnswers, "answer not applied yet", "answers not applied yet")] : []),
  ];
  const target = existingKey ? `Updates ${existingKey}` : `Creates a new issue in ${projectLabel}`;
  // The stored warnings can be older than the draft on screen (an autosaved edit survived a reload), so re-check the
  // claims when the evidence is available. Issues about the report (a finding) or the evidence list itself are not
  // editable here and stay as the run stored them.
  const shownIssues = evidence
    ? [
        ...issues.filter((issue) => !isClaimPath(issue.path)),
        ...draftIssues(draft, evidence).filter((issue) => isClaimPath(issue.path)),
      ]
    : issues;
  const blocking = shownIssues.filter(isBlockingIssue);
  const warningCount = shownIssues.length - blocking.length;
  const unresolved = [
    ...pendingReasons,
    ...(blocking.length
      ? [countLabel(blocking.length, "claim does not match its evidence", "claims do not match their evidence")]
      : []),
    ...(warningCount
      ? [countLabel(warningCount, "claim decides an open question", "claims decide an open question")]
      : []),
  ];

  // An evidence warning is a link into the editor: show the section it points at and mark it.
  const showClaim = (path: string) => {
    const section = path.startsWith("acceptanceCriteria") ? "acceptanceCriteria" : "description";
    setTab("edit");
    setHighlight(section);
    setTimeout(
      () => document.getElementById(`edit-${section}`)?.scrollIntoView({ block: "center", behavior: "smooth" }),
      0,
    );
    setTimeout(() => setHighlight(null), 2500);
  };

  useEffect(() => setDraftEdited?.(edited), [edited, setDraftEdited]);
  useWarnBeforeLeaving(edited);
  const saveStatus = useAutosave(draft, save, edited);

  const approve = () => {
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
      <EvidenceWarnings issues={shownIssues} onSelect={showClaim} />
      <Tabs value={tab} onValueChange={setTab} className="gap-4">
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
            highlight={highlight}
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
        <PublishedBar
          trackerName={trackerName}
          issueKey={result.issueKey ?? null}
          issueUrl={result.issueUrl ?? null}
          existingKey={existingKey}
          projectId={projectId}
        />
      ) : (
        <ApprovalBar
          publishLabel={publishLabel}
          trackerName={trackerName}
          target={target}
          labelled={readiness.labelled}
          unresolved={unresolved}
          unappliedAnswers={unappliedAnswers}
          blocking={blocking.length}
          pending={pending}
          updating={updating}
          onApprove={approve}
        />
      )}
    </div>
  );
}
