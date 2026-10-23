"use client";

import { MessageCircleQuestion } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { Clarification } from "@/core/requirements/schemas";
import type { ActionState } from "@/lib/action-state";

type Question = { question: string; impact: string };

type Props = {
  questions: Question[];
  trackerName: string;
  answer: (answers: Clarification[]) => Promise<ActionState>;
};

export function ClarifyQuestions({ questions, trackerName, answer }: Props) {
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ""));
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const answered = answers.filter((value) => value.trim()).length;

  function submit() {
    setError(undefined);
    startTransition(async () => {
      const result = await answer(
        questions.map((q, i) => ({ question: q.question, answer: answers[i]?.trim() ?? "" })),
      );
      if (result.error) setError(result.error);
    });
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
        {questions.map((q, i) => (
          <div key={q.question} className="flex flex-col gap-1.5">
            <label htmlFor={`answer-${i}`} className="text-sm font-medium">
              {q.question}
            </label>
            <p id={`impact-${i}`} className="text-xs text-muted-foreground">
              Why it matters: {q.impact}
            </p>
            <Textarea
              id={`answer-${i}`}
              aria-describedby={`impact-${i}`}
              value={answers[i] ?? ""}
              disabled={pending}
              placeholder="Your answer (optional)"
              className="min-h-12"
              onChange={(e) => setAnswers((current) => current.map((value, n) => (n === i ? e.target.value : value)))}
            />
          </div>
        ))}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
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
