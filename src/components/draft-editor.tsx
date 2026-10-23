"use client";

import { useState, useTransition } from "react";
import { EditableList } from "@/components/editable-list";
import { EvidenceList } from "@/components/evidence-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ClaimStatus } from "@/core/evidence/schemas";
import type { TicketDraft } from "@/core/requirements/schemas";

export type PublishResult = { error?: string; issueKey?: string; issueUrl?: string };

type Props = {
  initial: TicketDraft;
  publish: (draft: TicketDraft) => Promise<PublishResult>;
  publishLabel: string;
  publishedUrl?: string | null;
};

const STATUSES: ClaimStatus[] = ["verified", "inferred", "unknown", "needs_clarification"];

function StatusSelect({ value, onChange }: { value: ClaimStatus; onChange: (status: ClaimStatus) => void }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as ClaimStatus)}
      aria-label="Claim status"
      className="h-9 w-fit rounded-lg border bg-background px-2 text-sm"
    >
      {STATUSES.map((status) => (
        <option key={status} value={status}>
          {status.replace("_", " ")}
        </option>
      ))}
    </select>
  );
}

export function DraftEditor({ initial, publish, publishLabel, publishedUrl }: Props) {
  const [draft, setDraft] = useState(initial);
  const [result, setResult] = useState<PublishResult>(publishedUrl ? { issueUrl: publishedUrl } : {});
  const [pending, startTransition] = useTransition();
  const patch = (changes: Partial<TicketDraft>) => setDraft((current) => ({ ...current, ...changes }));
  const published = Boolean(result.issueUrl);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="draft-title" className="font-medium">
          Title
        </label>
        <Input
          id="draft-title"
          value={draft.title}
          disabled={published}
          onChange={(e) => patch({ title: e.target.value })}
        />
      </div>

      <EditableList
        title="Description"
        hint="Anything not verified is labelled in Jira."
        items={draft.description}
        minItems={1}
        onChange={(description) => patch({ description })}
        createItem={() => ({ text: "", status: "needs_clarification" as const, evidenceIds: [] })}
        addLabel="Add paragraph"
        renderItem={(item, update) => (
          <>
            <Textarea value={item.text} onChange={(e) => update({ text: e.target.value })} disabled={published} />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <StatusSelect value={item.status} onChange={(status) => update({ status })} />
              {item.evidenceIds.length > 0 && <span>Evidence: {item.evidenceIds.join(", ")}</span>}
            </div>
          </>
        )}
      />

      <EditableList
        title="Acceptance criteria"
        items={draft.acceptanceCriteria}
        onChange={(acceptanceCriteria) => patch({ acceptanceCriteria })}
        createItem={() => ({
          text: "",
          status: "needs_clarification" as const,
          evidenceIds: [],
          requiresProductDecision: true,
        })}
        addLabel="Add criterion"
        renderItem={(item, update) => (
          <>
            <Textarea value={item.text} onChange={(e) => update({ text: e.target.value })} disabled={published} />
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <StatusSelect value={item.status} onChange={(status) => update({ status })} />
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={item.requiresProductDecision}
                  onChange={(e) => update({ requiresProductDecision: e.target.checked })}
                />
                Needs product decision
              </label>
              {item.evidenceIds.length > 0 && <span>Evidence: {item.evidenceIds.join(", ")}</span>}
            </div>
          </>
        )}
      />

      <EditableList
        title="Unverified assumptions"
        items={draft.assumptions}
        onChange={(assumptions) => patch({ assumptions })}
        createItem={() => ({ text: "", rationale: "" })}
        addLabel="Add assumption"
        renderItem={(item, update) => (
          <>
            <Input
              value={item.text}
              placeholder="Assumption"
              onChange={(e) => update({ text: e.target.value })}
              disabled={published}
            />
            <Input
              value={item.rationale}
              placeholder="Why it cannot be verified"
              onChange={(e) => update({ rationale: e.target.value })}
              disabled={published}
            />
          </>
        )}
      />

      <EditableList
        title="Open questions"
        items={draft.openQuestions}
        onChange={(openQuestions) => patch({ openQuestions })}
        createItem={() => ({ question: "", impact: "" })}
        addLabel="Add question"
        renderItem={(item, update) => (
          <>
            <Input
              value={item.question}
              placeholder="Question"
              onChange={(e) => update({ question: e.target.value })}
              disabled={published}
            />
            <Input
              value={item.impact}
              placeholder="How the answer changes scope"
              onChange={(e) => update({ impact: e.target.value })}
              disabled={published}
            />
          </>
        )}
      />

      <section className="flex flex-col gap-3">
        <h3 className="font-medium">Evidence</h3>
        <EvidenceList evidence={draft.evidence} />
      </section>

      {result.error && (
        <Alert variant="destructive">
          <AlertTitle>Could not publish</AlertTitle>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      )}
      {published ? (
        <Alert>
          <AlertTitle>Published to Jira</AlertTitle>
          <AlertDescription>
            <a href={result.issueUrl} target="_blank" rel="noreferrer" className="underline">
              {result.issueKey ?? result.issueUrl}
            </a>
          </AlertDescription>
        </Alert>
      ) : (
        <Button
          className="self-start"
          disabled={pending}
          onClick={() => startTransition(async () => setResult(await publish(draft)))}
        >
          {pending ? "Publishing…" : publishLabel}
        </Button>
      )}
    </div>
  );
}
