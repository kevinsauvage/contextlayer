"use client";

import { useSyncExternalStore } from "react";

// Nothing ever changes the formatted value after mount, so there is nothing to subscribe to.
const subscribe = () => () => undefined;

// The server renders in its own time zone (UTC on a host), so the time is formatted in the browser, with the reader's
// locale and zone. The server snapshot is the UTC text, marked as such, until hydration replaces it.
export function LocalTime({ date, options }: { date: Date; options: Intl.DateTimeFormatOptions }) {
  const text = useSyncExternalStore(
    subscribe,
    () => date.toLocaleString(undefined, options),
    () => `${date.toLocaleString("en", { ...options, timeZone: "UTC" })} UTC`,
  );
  return <time dateTime={date.toISOString()}>{text}</time>;
}
