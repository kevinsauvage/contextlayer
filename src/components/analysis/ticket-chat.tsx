"use client";

import { Loader2, SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { FormError } from "@/components/form-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@/components/use-mutation";
import { isFollowUp, type Refinement, type TicketDraft } from "@/core/requirements/schemas";
import type { Analysis } from "@/features/projects/queries";
import type { ChatTurn } from "@/features/ticket-creation/actions";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";

type Question = TicketDraft["openQuestions"][number];

type Props = {
  request: string;
  refinements: Refinement[];
  status: Analysis["status"];
  error: string | null;
  draftTitle: string | null;
  questions: Question[];
  publishedKey: string | null;
  trackerName: string;
  canRefine: boolean;
  refine: (turn: ChatTurn) => Promise<ActionState>;
};

function Bubble({ from, children }: { from: "user" | "assistant"; children: ReactNode }) {
  return (
    <div className={cn("flex", from === "user" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[90%] rounded-2xl px-3 py-2 text-sm",
          from === "user" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted",
        )}
      >
        {children}
      </div>
    </div>
  );
}

const Text = ({ children }: { children: string }) => <p className="whitespace-pre-wrap">{children}</p>;

function History({ refinements }: { refinements: Refinement[] }) {
  return refinements.map((refinement, i) =>
    isFollowUp(refinement) ? (
      <Bubble key={i} from="user">
        <Text>{refinement.message}</Text>
      </Bubble>
    ) : (
      refinement.answer && (
        <div key={i} className="flex flex-col gap-2">
          <Bubble from="assistant">
            <Text>{refinement.question}</Text>
          </Bubble>
          <Bubble from="user">
            <Text>{refinement.answer}</Text>
          </Bubble>
        </div>
      )
    ),
  );
}

function QuestionField({
  index,
  question,
  value,
  disabled,
  onChange,
}: {
  index: number;
  question: Question;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const options = question.options ?? [];
  const impactId = `impact-${index}`;
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border bg-background p-3" aria-describedby={impactId}>
      <legend className="px-1 font-medium">{question.question}</legend>
      <p id={impactId} className="text-xs text-muted-foreground">
        Why it matters: {question.impact}
      </p>
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {options.map((option, optionIndex) => (
            <Button
              key={optionIndex}
              type="button"
              size="sm"
              variant={value === option.text ? "default" : "outline"}
              aria-pressed={value === option.text}
              disabled={disabled}
              className="h-auto max-w-full py-1 text-left whitespace-normal"
              onClick={() => onChange(value === option.text ? "" : option.text)}
            >
              {option.text}
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
        <p className="text-xs text-muted-foreground">Why recommended: {question.recommendation}</p>
      )}
      <Input
        aria-label={`Answer: ${question.question}`}
        value={value}
        disabled={disabled}
        placeholder={options.length ? "Or type an answer" : "Your answer (optional)"}
        onChange={(e) => onChange(e.target.value)}
      />
    </fieldset>
  );
}

function LatestReply({
  status,
  error,
  draftTitle,
  questions,
  publishedKey,
  trackerName,
  answers,
  pending,
  setAnswer,
}: Pick<Props, "status" | "error" | "draftTitle" | "questions" | "publishedKey" | "trackerName"> & {
  answers: string[];
  pending: boolean;
  setAnswer: (index: number, value: string) => void;
}) {
  if (status === "running") {
    return (
      <Bubble from="assistant">
        <p className="flex items-center gap-2" role="status">
          <Loader2 aria-hidden className="size-4 animate-spin" /> Investigating the project. Refresh in a moment.
        </p>
      </Bubble>
    );
  }
  if (status === "failed") {
    return (
      <Bubble from="assistant">
        <p className="text-destructive">The draft failed: {error ?? "unknown error"}. Send a message to try again.</p>
      </Bubble>
    );
  }
  if (publishedKey) {
    return (
      <Bubble from="assistant">
        <Text>{`Published to ${trackerName} as ${publishedKey}.`}</Text>
      </Bubble>
    );
  }
  return (
    <Bubble from="assistant">
      <div className="flex flex-col gap-3">
        <p>
          {draftTitle ? (
            <>
              Here is the draft: <strong>{draftTitle}</strong>.{" "}
            </>
          ) : (
            "The draft is ready. "
          )}
          {questions.length === 0
            ? "Tell me anything to change, or approve it."
            : questions.length === 1
              ? "One question before it is ready:"
              : `${questions.length} questions before it is ready:`}
        </p>
        {questions.map((question, i) => (
          <QuestionField
            key={i}
            index={i}
            question={question}
            value={answers[i] ?? ""}
            disabled={pending}
            onChange={(value) => setAnswer(i, value)}
          />
        ))}
        {questions.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Skip any you cannot answer; they stay in the ticket as open questions.
          </p>
        )}
      </div>
    </Bubble>
  );
}

export function TicketChat(props: Props) {
  const { request, refinements, questions, trackerName, canRefine, refine } = props;
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ""));
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState<string[]>([]);
  const { run, pending, error } = useMutation();
  const threadRef = useRef<HTMLDivElement>(null);

  const answered = questions
    .map((q, i) => ({ question: q.question, answer: answers[i]?.trim() ?? "" }))
    .filter((pair) => pair.answer);
  const canSend = canRefine && !pending && (message.trim() !== "" || answered.length > 0);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [refinements.length, pending]);

  const setAnswer = (index: number, value: string) =>
    setAnswers((current) => current.map((previous, i) => (i === index ? value : previous)));

  function send() {
    if (!canSend) return;
    setSent([...answered.map((pair) => `${pair.question}\n→ ${pair.answer}`), message.trim()].filter(Boolean));
    run(async () => {
      const result = await refine({
        answers: questions.map((q, i) => ({ question: q.question, answer: answers[i]?.trim() ?? "" })),
        message,
      });
      if (!result.error) setMessage("");
      return result;
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send();
  }

  return (
    <section
      aria-label="Conversation"
      className="flex flex-col overflow-hidden rounded-xl border bg-card lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)]"
    >
      <div ref={threadRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
        <Bubble from="user">
          <Text>{request}</Text>
        </Bubble>
        <History refinements={refinements} />
        {pending ? (
          <>
            {sent.map((text, i) => (
              <Bubble key={i} from="user">
                <Text>{text}</Text>
              </Bubble>
            ))}
            <Bubble from="assistant">
              <p className="flex items-center gap-2" role="status">
                <Loader2 aria-hidden className="size-4 animate-spin" /> Redrafting. This usually takes under a minute.
              </p>
            </Bubble>
          </>
        ) : (
          <LatestReply {...props} answers={answers} pending={pending} setAnswer={setAnswer} />
        )}
      </div>
      {!props.publishedKey && (
        <form
          className="flex flex-col gap-2 border-t p-3"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <FormError error={error} />
          <div className="flex items-end gap-2">
            <Textarea
              aria-label="Message"
              value={message}
              disabled={!canRefine || pending}
              placeholder={questions.length ? "Answer above, or tell me what to change" : "Tell me what to change"}
              className="max-h-40 min-h-10 resize-none"
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <Button type="submit" size="icon" disabled={!canSend} aria-label="Send">
              <SendHorizontal />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Each message redrafts the ticket and replaces manual edits. Nothing is sent to {trackerName} until you
            approve.
          </p>
        </form>
      )}
    </section>
  );
}
