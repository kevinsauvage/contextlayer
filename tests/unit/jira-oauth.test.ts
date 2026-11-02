import { afterEach, describe, expect, it, vi } from "vitest";
import { listJiraSites, refreshJiraTokens } from "@/integrations/jira/oauth";

vi.stubEnv("JIRA_CLIENT_ID", "client");
vi.stubEnv("JIRA_CLIENT_SECRET", "secret");

afterEach(() => vi.unstubAllGlobals());

const signals: (AbortSignal | null | undefined)[] = [];
const stubFetch = (body: unknown) =>
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    signals.push(init.signal);
    return new Response(JSON.stringify(body), { status: 200 });
  });

// A refresh holds the grant's row lock, so every Atlassian request must give up on its own.
describe("Atlassian requests", () => {
  it("bound the token refresh with a timeout", async () => {
    stubFetch({ access_token: "at", refresh_token: "rt", expires_in: 3600 });
    await refreshJiraTokens("rt-old");
    expect(signals.at(-1)).toBeInstanceOf(AbortSignal);
  });

  it("bound the site listing with a timeout", async () => {
    stubFetch([]);
    await listJiraSites("at");
    expect(signals.at(-1)).toBeInstanceOf(AbortSignal);
  });
});
