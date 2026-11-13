"use client";

/** Last-resort boundary when the root layout itself fails. Kept dependency-free. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0b1310", color: "#eef2ef", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 32 }}>
        <div role="alert">
          <p style={{ fontSize: 48, margin: 0 }} aria-hidden>
            🦉
          </p>
          <h1 style={{ fontSize: 24, margin: "16px 0 8px" }}>Owwy couldn&apos;t start</h1>
          <p style={{ opacity: 0.75, maxWidth: 340, margin: "0 auto" }}>Your data is still on this device. Please try again.</p>
          <button type="button" onClick={reset} style={{ marginTop: 24, height: 44, padding: "0 24px", borderRadius: 999, border: 0, background: "#6cc7b3", color: "#062520", fontWeight: 600, fontSize: 15 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
