"use client";

/** Last-resort boundary when the root layout itself fails. Kept dependency-free. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0b1310", color: "#eef2ef", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 32 }}>
        <div role="alert">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#6cc7b3" strokeWidth="1.6" strokeLinecap="round" aria-hidden style={{ display: "block", margin: "0 auto" }}>
            <path d="M4 7a8 8 0 0 1 16 0v6a8 8 0 0 1-16 0Z" />
            <circle cx="9" cy="10" r="2.2" />
            <circle cx="15" cy="10" r="2.2" />
            <path d="m12 13 -1.2 1.6h2.4Z" fill="#6cc7b3" />
            <path d="M4.5 4.5 7 7M19.5 4.5 17 7" />
          </svg>
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
