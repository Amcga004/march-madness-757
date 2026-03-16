"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim()) {
      setMessage("Please enter your email.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage(error.message || "Unable to send sign-in link.");
    } else {
      setMessage("Magic link sent. Check your email.");
    }

    setIsLoading(false);
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Manager Login</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sign in with your manager email to access your draft controls.
        </p>

        <form onSubmit={handleMagicLink} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Email</label>
            <input
              type="email"
              className="w-full rounded-xl border px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="rounded-xl bg-slate-950 px-4 py-2 text-white disabled:opacity-50"
          >
            {isLoading ? "Sending..." : "Send Magic Link"}
          </button>

          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        </form>
      </div>
    </div>
  );
}