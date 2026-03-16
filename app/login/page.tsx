"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);
  const [magicLinkEmail, setMagicLinkEmail] = useState("");
  const [passwordEmail, setPasswordEmail] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [message, setMessage] = useState("");
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [isSigningInWithPassword, setIsSigningInWithPassword] = useState(false);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();

    if (!magicLinkEmail.trim()) {
      setMessage("Please enter your email.");
      return;
    }

    setIsSendingMagicLink(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email: magicLinkEmail.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/draft`,
      },
    });

    if (error) {
      setMessage(error.message || "Unable to send sign-in link.");
    } else {
      setMessage("Magic link sent. Check your email.");
    }

    setIsSendingMagicLink(false);
  }

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();

    if (!passwordEmail.trim() || !passwordValue.trim()) {
      setMessage("Please enter both email and password.");
      return;
    }

    setIsSigningInWithPassword(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email: passwordEmail.trim(),
      password: passwordValue,
    });

    if (error) {
      setMessage(error.message || "Unable to sign in.");
      setIsSigningInWithPassword(false);
      return;
    }

    window.location.href = "/draft";
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="mb-5 sm:mb-6">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Account Access
        </div>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
          Manager Login
        </h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Sign in to access draft controls and make picks when it is your turn.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold text-slate-900">Magic Link Login</h2>
          <p className="mt-1 text-sm text-slate-600">
            For managers using email link sign-in.
          </p>

          <form onSubmit={handleMagicLink} className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Email</label>
              <input
                type="email"
                className="w-full rounded-xl border px-3 py-2"
                value={magicLinkEmail}
                onChange={(e) => setMagicLinkEmail(e.target.value)}
                placeholder="Enter your email"
              />
            </div>

            <button
              type="submit"
              disabled={isSendingMagicLink}
              className="rounded-xl bg-slate-950 px-4 py-2 text-white disabled:opacity-50"
            >
              {isSendingMagicLink ? "Sending..." : "Send Magic Link"}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold text-slate-900">Email + Password</h2>
          <p className="mt-1 text-sm text-slate-600">
            For password-based sign-in.
          </p>

          <form onSubmit={handlePasswordSignIn} className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Email</label>
              <input
                type="email"
                className="w-full rounded-xl border px-3 py-2"
                value={passwordEmail}
                onChange={(e) => setPasswordEmail(e.target.value)}
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Password</label>
              <input
                type="password"
                className="w-full rounded-xl border px-3 py-2"
                value={passwordValue}
                onChange={(e) => setPasswordValue(e.target.value)}
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={isSigningInWithPassword}
              className="rounded-xl bg-slate-950 px-4 py-2 text-white disabled:opacity-50"
            >
              {isSigningInWithPassword ? "Signing In..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>

      {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}