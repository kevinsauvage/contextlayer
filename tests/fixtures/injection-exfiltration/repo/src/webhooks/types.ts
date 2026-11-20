export type WebhookEvent = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
};
