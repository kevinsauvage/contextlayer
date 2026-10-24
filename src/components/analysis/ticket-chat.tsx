"use client";

import { Loader2, SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { FormError } from "@/components/form-error";
import { InlineText } from "@/components/analysis/inline-text";
import { DiscardEditsConfirm } from "@/components/analysis/discard-edits-confirm";
import { OPEN_QUESTIONS_ANCHOR } from "@/components/analysis/open-questions";
import { useRefinement } from "@/components/analysis/refinement-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { isFollowUp, type Refinement } from "@/core/requirements/schemas";
import type { Analysis } from "@/features/projects/queries";
import { cn } from "@/lib/utils";

type Props = {
  request: string;
  refinements: Refinement[];
  status: Analysis["status"];
  error: string | null;
  draftTitle: string | null;
  publishedKey: string | null;
  publishedUrl: string | null;
  trackerName: string;
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

const Text = ({ children }: { children: string }) => (
  <p className="whitespace-pre-wrap">
    <InlineText>{children}</InlineText>
  </p>
);

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

function LatestReply({
  status,
  error,
  draftTitle,
  publishedKey,
  publishedUrl,
  trackerName,
  questionCount,
}: Pick<Props, "status" | "error" | "draftTitle" | "publishedKey" | "publishedUrl" | "trackerName"> & {
  questionCount: number;
}) {
  if (status === "running") {
    return (
      <Bubble from="assistant">
        <p className="flex items-center gap-2">
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
        <p>
          Published to {trackerName} as{" "}
          {publishedUrl ? (
            <a href={publishedUrl} target="_blank" rel="noreferrer" className="font-medium underline">
              {publishedKey}
            </a>
          ) : (
            publishedKey
          )}
          .
        </p>
      </Bubble>
    );
  }
  return (
    <Bubble from="assistant">
      <p>
        {draftTitle ? (
          <>
            Here is the draft:{" "}
            <strong>
              <InlineText>{draftTitle}</InlineText>
            </strong>
            .{" "}
          </>
        ) : (
          "The draft is ready. "
        )}
        {questionCount === 0 ? (
          "Tell me anything to change, or approve it."
        ) : (
          <>
            {questionCount === 1 ? "One question needs" : `${questionCount} questions need`} a decision. Answer them in{" "}
            <a href={`#${OPEN_QUESTIONS_ANCHOR}`} className="font-medium underline">
              Open questions
            </a>
            , or tell me what to change.
          </>
        )}
      </p>
    </Bubble>
  );
}

export function TicketChat(props: Props) {
  const { request, refinements, trackerName } = props;
  const { questions, canRefine, sent, errorFor, send } = useRefinement();
  const [message, setMessage] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const pending = sent !== null;
  const canSend = canRefine && !pending && message.trim() !== "";

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [refinements.length, pending]);

  function submit() {
    if (canSend) send("chat", message, () => setMessage(""));
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  }

  return (
    <section
      aria-label="Conversation"
      className="flex flex-col overflow-hidden rounded-xl border bg-card lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)]"
    >
      <div ref={threadRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <Bubble from="user">
          <Text>{request}</Text>
        </Bubble>
        <History refinements={refinements} />
        <div aria-live="polite" className="flex flex-col gap-3">
          {sent ? (
            <>
              {[...sent.answered.map((pair) => `${pair.question}\n→ ${pair.answer}`), sent.message]
                .filter(Boolean)
                .map((text, i) => (
                  <Bubble key={i} from="user">
                    <Text>{text}</Text>
                  </Bubble>
                ))}
              <Bubble from="assistant">
                <p className="flex items-center gap-2">
                  <Loader2 aria-hidden className="size-4 animate-spin" /> Redrafting. This usually takes under a minute.
                </p>
              </Bubble>
            </>
          ) : (
            <LatestReply {...props} questionCount={questions.length} />
          )}
        </div>
      </div>
      {!props.publishedKey && (
        <form
          className="flex flex-col gap-2 border-t p-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <FormError error={errorFor("chat")} />
          <DiscardEditsConfirm origin="chat" action="send" />
          <div className="flex items-end gap-2">
            <Textarea
              aria-label="Ask for a change"
              value={message}
              disabled={!canRefine || pending}
              placeholder="Ask for a change"
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
