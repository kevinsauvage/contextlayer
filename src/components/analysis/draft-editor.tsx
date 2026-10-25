"use client";

import { useId } from "react";
import { EditableList } from "@/components/analysis/editable-list";
import { EvidenceList } from "@/components/analysis/evidence-list";
import { OPEN_QUESTIONS_ANCHOR } from "@/components/analysis/open-questions";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { CLAIM_STATUSES, CLAIM_STATUS_LABELS, type Claim, type ClaimStatus } from "@/core/evidence/schemas";
import type { TicketDraft } from "@/core/requirements/schemas";

type Props = {
  draft: TicketDraft;
  onChange: (draft: TicketDraft) => void;
  disabled: boolean;
  trackerName: string;
  // When the open questions are answered in their own block, they are not edited here too.
  questionsAnchored?: boolean;
};

type ClaimStatusFieldProps = { claim: Claim; label: string; onChange: (status: ClaimStatus) => void };

// Verified requires cited evidence; approval rejects it otherwise (validateEvidenceReferences).
function ClaimStatusField({ claim, label, onChange }: ClaimStatusFieldProps) {
  const warningId = useId();
  const hasEvidence = claim.evidenceIds.length > 0;
  const unsupported = claim.status === "verified" && !hasEvidence;
  return (
    <>
      <NativeSelect
        value={claim.status}
        onChange={(event) => onChange(event.target.value as ClaimStatus)}
        aria-label={`Status of ${label.toLowerCase()}`}
        aria-invalid={unsupported || undefined}
        aria-describedby={unsupported ? warningId : undefined}
        className="w-fit"
      >
        {CLAIM_STATUSES.map((status) => (
          <NativeSelectOption key={status} value={status} disabled={status === "verified" && !hasEvidence}>
            {status === "verified" && !hasEvidence ? "Verified (needs evidence)" : CLAIM_STATUS_LABELS[status]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {hasEvidence ? (
        <span>Evidence: {claim.evidenceIds.join(", ")}</span>
      ) : (
        unsupported && (
          <span id={warningId} className="text-destructive">
            No evidence is cited, so this cannot be Verified.
          </span>
        )
      )}
    </>
  );
}

export function DraftEditor({ draft, onChange, disabled: published, trackerName, questionsAnchored = false }: Props) {
  const patch = (changes: Partial<TicketDraft>) => onChange({ ...draft, ...changes });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="draft-title" className="font-medium">
          Title
        </label>
        <Input
          id="draft-title"
          value={draft.title}
          maxLength={255}
          disabled={published}
          onChange={(e) => patch({ title: e.target.value })}
        />
      </div>

      <EditableList
        title="Description"
        itemLabel="Description paragraph"
        hint={`Verified claims need cited evidence. Every other status is labelled in ${trackerName}.`}
        items={draft.description}
        minItems={1}
        onChange={(description) => patch({ description })}
        createItem={() => ({ text: "", status: "needs_clarification" as const, evidenceIds: [] })}
        addLabel="Add paragraph"
        renderItem={(item, update, label) => (
          <>
            <Textarea
              aria-label={label}
              value={item.text}
              onChange={(e) => update({ text: e.target.value })}
              disabled={published}
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ClaimStatusField claim={item} label={label} onChange={(status) => update({ status })} />
            </div>
          </>
        )}
      />

      <EditableList
        title="Acceptance criteria"
        itemLabel="Acceptance criterion"
        items={draft.acceptanceCriteria}
        onChange={(acceptanceCriteria) => patch({ acceptanceCriteria })}
        createItem={() => ({
          text: "",
          status: "needs_clarification" as const,
          evidenceIds: [],
          requiresProductDecision: true,
        })}
        addLabel="Add criterion"
        renderItem={(item, update, label) => (
          <>
            <Textarea
              aria-label={label}
              value={item.text}
              onChange={(e) => update({ text: e.target.value })}
              disabled={published}
            />
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <ClaimStatusField claim={item} label={label} onChange={(status) => update({ status })} />
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={item.requiresProductDecision}
                  onChange={(e) => update({ requiresProductDecision: e.target.checked })}
                />
                Needs product decision
              </label>
            </div>
          </>
        )}
      />

      <EditableList
        title="Unverified assumptions"
        itemLabel="Assumption"
        items={draft.assumptions}
        onChange={(assumptions) => patch({ assumptions })}
        createItem={() => ({ text: "", rationale: "" })}
        addLabel="Add assumption"
        renderItem={(item, update, label) => (
          <>
            <Input
              aria-label={label}
              value={item.text}
              placeholder="Assumption"
              onChange={(e) => update({ text: e.target.value })}
              disabled={published}
            />
            <Input
              aria-label={`Why ${label.toLowerCase()} cannot be verified`}
              value={item.rationale}
              placeholder="Why it cannot be verified"
              onChange={(e) => update({ rationale: e.target.value })}
              disabled={published}
            />
          </>
        )}
      />

      {questionsAnchored ? (
        <section className="flex flex-col gap-1">
          <h3 className="font-medium">Open questions</h3>
          <p className="text-sm text-muted-foreground">
            {draft.openQuestions.length ? "Answer them or leave them open in " : "None right now. New ones appear in "}
            <a href={`#${OPEN_QUESTIONS_ANCHOR}`} className="font-medium text-foreground underline underline-offset-2">
              Open questions
            </a>
            .
          </p>
        </section>
      ) : (
        <EditableList
          title="Open questions"
          itemLabel="Open question"
          items={draft.openQuestions}
          onChange={(openQuestions) => patch({ openQuestions })}
          createItem={() => ({ question: "", impact: "" })}
          addLabel="Add question"
          renderItem={(item, update, label) => (
            <>
              <Input
                aria-label={label}
                value={item.question}
                placeholder="Question"
                onChange={(e) => update({ question: e.target.value })}
                disabled={published}
              />
              <Input
                aria-label={`How the answer to ${label.toLowerCase()} changes scope`}
                value={item.impact}
                placeholder="How the answer changes scope"
                onChange={(e) => update({ impact: e.target.value })}
                disabled={published}
              />
            </>
          )}
        />
      )}

      <section className="flex flex-col gap-3">
        <h3 className="font-medium">Evidence</h3>
        <EvidenceList evidence={draft.evidence} />
      </section>
    </div>
  );
}
