import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, { headers: cookie ? { cookie } : {} });

const signedIn = "better-auth.session_token=abc";

describe("proxy", () => {
  it("redirects a signed-out app page and keeps the target", () => {
    const response = proxy(request("/projects?tab=1"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("next")).toBe("/projects?tab=1");
  });

  it("serves sign-in without a session and adds a nonce policy", () => {
    const response = proxy(request("/sign-in"));

    expect(response.status).toBe(200);
    const policy = response.headers.get("Content-Security-Policy") ?? "";
    expect(policy).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(policy).toContain("style-src 'self' 'nonce-");
    expect(policy).toContain("frame-ancestors 'none'");
  });

  it("passes a signed-in page with a fresh nonce per request", () => {
    const first = proxy(request("/projects", signedIn));
    const second = proxy(request("/projects", signedIn));

    expect(first.status).toBe(200);
    expect(first.headers.get("x-middleware-next")).toBe("1");
    expect(first.headers.get("Content-Security-Policy")).not.toBe(second.headers.get("Content-Security-Policy"));
  });
});
