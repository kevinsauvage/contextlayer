"use client";

// Replaces the root layout when it fails, so it carries its own html/body and inline styles: the stylesheet may
// never have loaded.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const muted = { color: "#71717a", fontSize: 14, margin: 0 };
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <main role="alert" style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 560, padding: 32 }}>
          <h1 style={{ fontSize: 18, margin: 0 }}>Something went wrong</h1>
          <p style={muted}>
            The page could not load. Try again; if it keeps failing, share this reference:{" "}
            <code>{error.digest ?? "n/a"}</code>
          </p>
          <button
            onClick={retry}
            style={{
              alignSelf: "flex-start",
              border: "1px solid #d4d4d8",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              padding: "6px 12px",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
