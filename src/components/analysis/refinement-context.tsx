"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useMutation } from "@/components/use-mutation";
import type { Clarification, TicketDraft } from "@/core/requirements/schemas";
import type { ChatTurn } from "@/features/ticket-creation/actions";
import type { ActionState } from "@/lib/action-state";

export type Question = TicketDraft["openQuestions"][number];

// null marks a question the requester chose to leave open; "" is not decided yet.
type Answer = string | null;
type Origin = "chat" | "questions";
type Sent = { origin: Origin; message: string; answered: Clarification[] };
type Request = { origin: Origin; message: string; onSuccess?: () => void };

type Refinement = {
  questions: Question[];
  answers: Answer[];
  setAnswer: (index: number, value: Answer) => void;
  answered: Clarification[];
  canRefine: boolean;
  sent: Sent | null;
  errorFor: (origin: Origin) => string | undefined;
  send: (origin: Origin, message?: string, onSuccess?: () => void) => void;
  // Redrafting replaces the draft, so a send with manual edits waits for confirmation.
  setDraftEdited: (edited: boolean) => void;
  confirmingFor: (origin: Origin) => boolean;
  confirmDiscard: () => void;
  cancelDiscard: () => void;
};

const RefinementContext = createContext<Refinement | null>(null);

export function useRefinement() {
  const context = useContext(RefinementContext);
  if (!context) throw new Error("useRefinement needs a RefinementProvider");
  return context;
}

// The draft workspace also serves audits, which have no refinement round.
export const useOptionalRefinement = () => useContext(RefinementContext);

type Props = {
  questions: Question[];
  canRefine: boolean;
  refine: (turn: ChatTurn) => Promise<ActionState>;
  children: ReactNode;
};

// Chat and the open-questions block share one draft round, so answers typed in one survive a send from the other.
export function RefinementProvider({ questions, canRefine, refine, children }: Props) {
  const [answers, setAnswers] = useState<Answer[]>(() => questions.map(() => ""));
  const [sent, setSent] = useState<Sent | null>(null);
  const [draftEdited, setDraftEdited] = useState(false);
  const [confirming, setConfirming] = useState<Request | null>(null);
  const { run, pending, error } = useMutation();

  const answered = questions
    .map((q, i) => ({ question: q.question, answer: answers[i]?.trim() ?? "" }))
    .filter((pair) => pair.answer);

  const setAnswer = (index: number, value: Answer) =>
    setAnswers((current) => current.map((previous, i) => (i === index ? value : previous)));

  function send(origin: Origin, message = "", onSuccess?: () => void) {
    if (!canRefine || pending || (!message.trim() && answered.length === 0)) return;
    if (draftEdited) {
      setConfirming({ origin, message, onSuccess });
      return;
    }
    redraft({ origin, message, onSuccess });
  }

  function redraft({ origin, message, onSuccess }: Request) {
    setConfirming(null);
    setSent({ origin, message: message.trim(), answered });
    run(async () => {
      const result = await refine({
        answers: questions.map((q, i) => ({ question: q.question, answer: answers[i]?.trim() ?? "" })),
        message,
      });
      if (!result.error) onSuccess?.();
      return result;
    });
  }

  return (
    <RefinementContext
      value={{
        questions,
        answers,
        setAnswer,
        answered,
        canRefine,
        sent: pending ? sent : null,
        errorFor: (origin) => (sent?.origin === origin ? error : undefined),
        send,
        setDraftEdited,
        confirmingFor: (origin) => !pending && confirming?.origin === origin,
        confirmDiscard: () => {
          if (confirming) redraft(confirming);
        },
        cancelDiscard: () => setConfirming(null),
      }}
    >
      {children}
    </RefinementContext>
  );
}
