"use client";

import { Loader2 } from "lucide-react";
import { FormError } from "@/components/form-error";
import { DiscardEditsConfirm } from "@/components/analysis/discard-edits-confirm";
import { InlineText } from "@/components/analysis/inline-text";
import { useRefinement, type Question } from "@/components/analysis/refinement-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Clarification } from "@/core/requirements/schemas";
import { cn } from "@/lib/utils";

export const OPEN_QUESTIONS_ANCHOR = "open-questions";

type FieldProps = {
  index: number;
  question: Question;
  value: string | null | undefined;
  disabled: boolean;
  onChange: (value: string | null) => void;
};

function QuestionField({ index, question, value, disabled, onChange }: FieldProps) {
  const options = question.options ?? [];
  const leftOpen = value === null;
  const text = value ?? "";
  const impactId = `question-${index}-impact`;
  const state = leftOpen ? "Left open" : text.trim() ? "Answered" : undefined;
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <fieldset className="flex min-w-0 flex-col gap-2.5" aria-describedby={impactId}>
        <legend className="contents">
          <span className="flex items-start justify-between gap-3">
            <span className={cn("font-medium text-balance", leftOpen && "text-muted-foreground")}>
              <InlineText>{question.question}</InlineText>
            </span>
            {state && (
              <span className={cn("shrink-0 text-xs", leftOpen ? "text-muted-foreground" : "text-success")}>
                {state}
              </span>
            )}
          </span>
        </legend>
        <p id={impactId} className="text-sm text-muted-foreground">
          Why it matters: <InlineText>{question.impact}</InlineText>
        </p>
        {!leftOpen && (
          <>
            {options.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {options.map((option, optionIndex) => (
                  <Button
                    key={optionIndex}
                    type="button"
                    size="sm"
                    variant={text === option.text ? "default" : "outline"}
                    aria-pressed={text === option.text}
                    disabled={disabled}
                    className="h-auto max-w-full py-1 text-left whitespace-normal"
                    onClick={() => onChange(text === option.text ? "" : option.text)}
                  >
                    <InlineText>{option.text}</InlineText>
                    {option.recommended && (
                      <Badge variant="secondary" className="ml-1">
                        Recommended
                      </Badge>
                    )}
                  </Button>
                ))}
              </div>
            )}
            {question.recommendation && (
              <p className="text-xs text-muted-foreground">
                Why recommended: <InlineText>{question.recommendation}</InlineText>
              </p>
            )}
            <Input
              aria-label={`Answer: ${question.question}`}
              value={text}
              disabled={disabled}
              placeholder={options.length ? "Or type an answer" : "Type an answer"}
              onChange={(e) => onChange(e.target.value)}
            />
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="self-start text-muted-foreground"
          aria-pressed={leftOpen}
          disabled={disabled}
          onClick={() => onChange(leftOpen ? "" : null)}
        >
          {leftOpen ? "Answer instead" : "Leave open"}
        </Button>
      </fieldset>
    </li>
  );
}

function Decided({ decided }: { decided: Clarification[] }) {
  if (!decided.length) return null;
  return (
    <details className="group border-t pt-4 text-sm">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        Decided earlier ({decided.length})
      </summary>
      <dl className="mt-3 flex flex-col gap-3">
        {decided.map((pair, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">{pair.question}</dt>
            <dd className="font-medium">{pair.answer}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function OpenQuestions({ decided }: { decided: Clarification[] }) {
  const { questions, answers, setAnswer, answered, canRefine, sent, errorFor, send, confirmingFor } = useRefinement();
  if (!questions.length && !decided.length) return null;

  const pending = sent !== null;
  const decidedCount = answers.filter((answer) => answer === null || answer.trim()).length;
  const sendingHere = sent?.origin === "questions";

  return (
    <section
      id={OPEN_QUESTIONS_ANCHOR}
      aria-labelledby="open-questions-heading"
      className="flex scroll-mt-24 flex-col gap-4 rounded-xl bg-card p-5 shadow-surface ring-1 ring-foreground/8"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="open-questions-heading" className="font-semibold">
            Open questions
          </h2>
          {questions.length > 0 && (
            <span className="text-sm text-muted-foreground tabular-nums">
              {decidedCount} of {questions.length} decided
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {questions.length
            ? "Answer what you can. Anything left open is published in the ticket as an open question."
            : "Nothing is waiting on a decision."}
        </p>
      </div>

      {questions.length > 0 && (
        <>
          <ol className="flex flex-col divide-y">
            {questions.map((question, i) => (
              <QuestionField
                key={i}
                index={i}
                question={question}
                value={answers[i]}
                disabled={!canRefine || pending}
                onChange={(value) => setAnswer(i, value)}
              />
            ))}
          </ol>
          <div className="flex flex-col gap-2 border-t pt-4">
            <FormError error={errorFor("questions")} />
            <DiscardEditsConfirm origin="questions" action="update" />
            {!confirmingFor("questions") && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground" role="status">
                  {sendingHere
                    ? "Updating the draft with your answers…"
                    : answered.length
                      ? "Updating redrafts the ticket and replaces manual edits."
                      : "Answer at least one question to update the draft."}
                </p>
                <Button
                  type="button"
                  disabled={!canRefine || pending || answered.length === 0}
                  onClick={() => send("questions")}
                >
                  {sendingHere ? (
                    <>
                      <Loader2 aria-hidden className="animate-spin" /> Updating draft
                    </>
                  ) : answered.length ? (
                    `Update draft with ${plural(answered.length, "answer")}`
                  ) : (
                    "Update draft"
                  )}
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      <Decided decided={decided} />
    </section>
  );
}
