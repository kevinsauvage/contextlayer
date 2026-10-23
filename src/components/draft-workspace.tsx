"use client";

import { CircleCheck, ExternalLink } from "lucide-react";
import { useState, useTransition } from "react";
import { DraftEditor } from "@/components/draft-editor";
import { TicketPreview } from "@/components/ticket-preview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TicketDraft } from "@/core/requirements/schemas";
import type { PublishResult } from "@/features/analysis/publish";

type Props = {
  initial: TicketDraft;
  publish: (draft: TicketDraft) => Promise<PublishResult>;
  publishLabel: string;
  trackerName: string;
  projectLabel: string;
  // The audited issue, when the draft updates an existing ticket.
  existingKey?: string;
  published: { key: string | null; url: string | null };
};

export function DraftWorkspace({
  initial,
  publish,
  publishLabel,
  trackerName,
  projectLabel,
  existingKey,
  published: initialPublished,
}: Props) {
  const [draft, setDraft] = useState(initial);
  const [result, setResult] = useState<PublishResult>(
    initialPublished.url ? { issueUrl: initialPublished.url, issueKey: initialPublished.key ?? undefined } : {},
  );
  const [pending, startTransition] = useTransition();
  const published = Boolean(result.issueUrl);

  return (
    <div className="flex flex-col gap-4">
      <Tabs defaultValue="preview" className="gap-4">
        <TabsList>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="edit" disabled={published}>
            Edit
          </TabsTrigger>
        </TabsList>
        <TabsContent value="preview">
          <TicketPreview
            draft={draft}
            trackerName={trackerName}
            projectLabel={projectLabel}
            issueKey={result.issueKey ?? existingKey ?? null}
          />
        </TabsContent>
        <TabsContent value="edit">
          <DraftEditor draft={draft} onChange={setDraft} disabled={published} trackerName={trackerName} />
        </TabsContent>
      </Tabs>

      {result.error && (
        <Alert variant="destructive">
          <AlertTitle>Could not publish</AlertTitle>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      )}
      {published ? (
        <Alert>
          <CircleCheck />
          <AlertTitle>Published to {trackerName}</AlertTitle>
          <AlertDescription>
            <a
              href={result.issueUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline"
            >
              {result.issueKey ?? result.issueUrl} <ExternalLink className="size-3.5" />
            </a>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur">
          <p className="text-sm text-muted-foreground">Nothing is sent to {trackerName} until you approve.</p>
          <Button disabled={pending} onClick={() => startTransition(async () => setResult(await publish(draft)))}>
            {pending ? "Publishing…" : publishLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
