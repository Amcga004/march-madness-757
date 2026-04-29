"use client";

export default function GameDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      maxWidth: "680px", margin: "0 auto", padding: "32px 16px",
      color: "#F1F3F5", background: "#0D1117", minHeight: "100vh",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px",
    }}>
      <div style={{ fontSize: "13px", color: "#DC2626", fontWeight: 600 }}>Page Error</div>
      <div style={{ fontSize: "12px", color: "#6B7280", textAlign: "center", maxWidth: "400px", lineHeight: 1.6 }}>
        {error.message}
      </div>
      <pre style={{ fontSize: "10px", color: "#4B5563", background: "#161B22", padding: "12px", borderRadius: "8px", maxWidth: "100%", overflowX: "auto", whiteSpace: "pre-wrap" }}>
        {error.stack}
      </pre>
      <button onClick={reset} style={{ padding: "8px 16px", borderRadius: "8px", background: "#EA6C0A", color: "white", border: "none", cursor: "pointer", fontSize: "13px" }}>
        Try again
      </button>
    </div>
  );
}
