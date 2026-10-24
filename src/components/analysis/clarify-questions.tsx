"use client";

import { MessageCircleQuestion } from "lucide-react";
import { useState } from "react";
import { FormError } from "@/components/form-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@/components/use-mutation";
import type { AnswerOption, Clarification, TicketDraft } from "@/core/requirements/schemas";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";

type Question = TicketDraft["openQuestions"][number];

type Props = {
  questions: Question[];
  trackerName: string;
  answer: (answers: Clarification[]) => Promise<ActionState>;
};

function OptionChoice({
  name,
  option,
  selected,
  disabled,
  onSelect,
}: {
  name: string;
  option: AnswerOption;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm",
        selected ? "border-primary/60 bg-muted/40" : "hover:bg-muted/30",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={selected}
        disabled={disabled}
        onChange={onSelect}
        className="mt-0.5 accent-primary"
      />
      <span className="flex-1">{option.text}</span>
      {option.recommended && (
        <Badge variant="secondary" className="shrink-0">
          Recommended
        </Badge>
      )}
    </label>
  );
}

export function ClarifyQuestions({ questions, trackerName, answer }: Props) {
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ""));
  const { run, pending, error } = useMutation();
  const answered = answers.filter((value) => value.trim()).length;

  const setAnswer = (index: number, value: string) =>
    setAnswers((current) => current.map((current, i) => (i === index ? value : current)));

  function submit() {
    run(() => answer(questions.map((q, i) => ({ question: q.question, answer: answers[i]?.trim() ?? "" }))));
  }

  return (
    <Card className="ring-amber-500/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircleQuestion aria-hidden className="size-4 text-amber-600" />
          {questions.length === 1 ? "One question" : `${questions.length} questions`} before this is ready
        </CardTitle>
        <CardDescription>
          Answer what you can and the ticket is redrafted with your answers. Anything left blank stays in the ticket as
          an open question for the team.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {questions.map((q, i) => {
          const selected = answers[i] ?? "";
          const options = q.options ?? [];
          return (
            <fieldset key={i} className="flex flex-col gap-2 rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">{q.question}</legend>
              <p id={`impact-${i}`} className="text-xs text-muted-foreground">
                Why it matters: {q.impact}
              </p>
              {options.length > 0 && (
                <div className="flex flex-col gap-1.5" aria-describedby={`impact-${i}`}>
                  {options.map((option, optionIndex) => (
                    <OptionChoice
                      key={optionIndex}
                      name={`answer-${i}`}
                      option={option}
                      selected={selected === option.text}
                      disabled={pending}
                      onSelect={() => setAnswer(i, option.text)}
                    />
                  ))}
                </div>
              )}
              {q.recommendation && <p className="text-xs text-muted-foreground">Why recommended: {q.recommendation}</p>}
              <label htmlFor={`answer-${i}`} className="text-xs text-muted-foreground">
                Your answer
              </label>
              <Textarea
                id={`answer-${i}`}
                aria-describedby={`impact-${i}`}
                value={selected}
                disabled={pending}
                placeholder={options.length ? "Type an answer instead" : "Your answer (optional)"}
                className="min-h-12"
                onChange={(e) => setAnswer(i, e.target.value)}
              />
            </fieldset>
          );
        })}
        <FormError error={error} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground" role={pending ? "status" : undefined}>
            {pending
              ? "Redrafting with your answers. This usually takes under a minute."
              : `${answered} of ${questions.length} answered. Manual edits to the draft are replaced; nothing is sent to ${trackerName}.`}
          </p>
          <Button onClick={submit} disabled={pending || answered === 0}>
            {pending ? "Updating…" : "Update ticket"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
