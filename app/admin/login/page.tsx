"use client";

import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const supabase = createClient();

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="rounded-2xl border bg-white p-8 shadow-sm">
        <h2 className="text-3xl font-bold">Admin Sign In</h2>
        <p className="mt-3 text-gray-600">
          Sign in with the commissioner Google account to access admin tools.
        </p>

        <button
          onClick={handleGoogleLogin}
          className="mt-6 rounded-xl bg-black px-4 py-2 text-white"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}