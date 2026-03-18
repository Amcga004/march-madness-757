"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [message, setMessage] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim() || !passwordValue.trim()) {
      setMessage("Please enter both email and password.");
      return;
    }

    setIsSigningIn(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: passwordValue,
    });

    if (error) {
      setMessage(error.message || "Unable to sign in.");
      setIsSigningIn(false);
      return;
    }

    window.location.href = "/draft";
  }

  return (
    <div className="mx-auto max-w-xl p-4 sm:p-6">
      <div className="mb-5 sm:mb-6">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Account Access
        </div>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Manager Login
        </h1>
        <p className="mt-2 text-sm text-slate-300 sm:text-base">
          Sign in to access draft controls and make picks when it is your turn.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur sm:p-6">
        <h2 className="text-xl font-semibold text-white">Email + Password</h2>
        <p className="mt-1 text-sm text-slate-300">
          Use your assigned manager credentials to access the draft room.
        </p>

        <form onSubmit={handlePasswordSignIn} className="mt-5 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Email
            </label>
            <input
              type="email"
              className="w-full rounded-xl border border-slate-600 bg-[#172033] px-3 py-2 text-white placeholder:text-slate-400 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Password
            </label>
            <input
              type="password"
              className="w-full rounded-xl border border-slate-600 bg-[#172033] px-3 py-2 text-white placeholder:text-slate-400 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              value={passwordValue}
              onChange={(e) => setPasswordValue(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={isSigningIn}
            className="rounded-xl bg-slate-950 px-4 py-2 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSigningIn ? "Signing In..." : "Sign In"}
          </button>
        </form>

        {message ? (
          <div className="mt-4 rounded-xl border border-slate-700 bg-[#172033] px-4 py-3 text-sm text-slate-300">
            {message}
          </div>
        ) : null}
      </div>
    </div>
  );
}