"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export default function LoginClient({
  next,
  error,
}: {
  next?: string;
  error?: string;
}) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(error === "auth" ? "Authentication failed. Please try again." : "");

  const supabase = createClient();
  const redirectTo = `${window.location.origin}/auth/callback?next=${next ?? "/"}`;

  async function signInWithGoogle() {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
  }

  async function signInWithApple() {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo },
    });
  }

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setErr("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      setErr(error.message);
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--color-background-tertiary)",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "400px",
        padding: "40px 32px",
        background: "var(--color-background-primary)",
        borderRadius: "12px",
        border: "0.5px solid var(--color-border-tertiary)",
      }}>
        {/* Logo */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "32px",
          justifyContent: "center",
        }}>
          <div style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "#EA6C0A",
          }} />
          <span style={{
            fontSize: "18px",
            fontWeight: 500,
            letterSpacing: "-0.02em",
            color: "#EA6C0A",
          }}>EdgePulse</span>
        </div>

        {sent ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "15px", fontWeight: 500, marginBottom: "8px" }}>
              Check your email
            </p>
            <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
              We sent a sign-in link to <strong>{email}</strong>. Click the link to continue.
            </p>
          </div>
        ) : (
          <>
            <p style={{
              fontSize: "13px",
              color: "var(--color-text-secondary)",
              textAlign: "center",
              marginBottom: "24px",
              lineHeight: 1.6,
            }}>
              Sign in to see betting signals, track bets, and play fantasy.
            </p>

            {err && (
              <div style={{
                padding: "10px 14px",
                background: "#DC262615",
                border: "0.5px solid #DC262640",
                borderRadius: "6px",
                fontSize: "12px",
                color: "#DC2626",
                marginBottom: "16px",
              }}>{err}</div>
            )}

            {/* OAuth buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              <button
                onClick={signInWithGoogle}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "0.5px solid var(--color-border-secondary)",
                  borderRadius: "8px",
                  background: "var(--color-background-secondary)",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--color-text-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <button
                onClick={signInWithApple}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "0.5px solid var(--color-border-secondary)",
                  borderRadius: "8px",
                  background: "var(--color-background-secondary)",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--color-text-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                Continue with Apple
              </button>
            </div>

            {/* Divider */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "20px",
            }}>
              <div style={{ flex: 1, height: "0.5px", background: "var(--color-border-tertiary)" }} />
              <span style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>or</span>
              <div style={{ flex: 1, height: "0.5px", background: "var(--color-border-tertiary)" }} />
            </div>

            {/* Email */}
            <form onSubmit={signInWithEmail}>
              <div style={{ marginBottom: "10px" }}>
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "0.5px solid var(--color-border-secondary)",
                    borderRadius: "8px",
                    background: "var(--color-background-secondary)",
                    fontSize: "13px",
                    color: "var(--color-text-primary)",
                    outline: "none",
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !email}
                style={{
                  width: "100%",
                  padding: "10px",
                  background: loading ? "var(--color-background-secondary)" : "#EA6C0A",
                  border: "none",
                  borderRadius: "8px",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: loading ? "var(--color-text-secondary)" : "#fff",
                }}
              >
                {loading ? "Sending..." : "Continue with email"}
              </button>
            </form>

            {/* Guest */}
            <div style={{ textAlign: "center", marginTop: "20px" }}>
              <a
                href="/"
                style={{
                  fontSize: "12px",
                  color: "var(--color-text-secondary)",
                  textDecoration: "none",
                }}
              >
                Continue as guest — limited access
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
