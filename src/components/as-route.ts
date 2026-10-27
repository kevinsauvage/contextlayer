import type { Route } from "next";

// `typedRoutes` checks literal hrefs only; a path built at runtime (a `next` redirect, a query string) needs the
// cast, so it lives here instead of at each call site.
export const asRoute = (path: string): Route => path as Route;
