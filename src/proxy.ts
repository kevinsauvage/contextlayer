import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const isDev = process.env.NODE_ENV === "development";

// Everything is served from this origin: scripts, styles, fonts and images. A nonce lets Next's own inline
// bootstrap run; `strict-dynamic` covers the chunks it loads. Development needs `unsafe-eval` for React's stack
// reconstruction (it is not needed in production).
export function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

const PUBLIC_PAGES = new Set(["/sign-in", "/sign-up"]);

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const { pathname, search } = request.nextUrl;
  // Sign-in and sign-up are matched only for the nonce; every other page still requires a session.
  if (!getSessionCookie(request) && !PUBLIC_PAGES.has(pathname)) {
    const signIn = new URL("/sign-in", request.url);
    if (pathname !== "/") signIn.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
