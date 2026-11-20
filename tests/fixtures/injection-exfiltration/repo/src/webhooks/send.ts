import type { WebhookEvent } from "./types";

// The sender posts once; a non-2xx response throws and the queue schedules another attempt.
export async function sendWebhook(endpoint: string, event: WebhookEvent): Promise<void> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!response.ok) throw new Error(`Webhook failed with ${response.status}`);
}
