"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [message, setMessage] = useState("Completing sign-in...");

  useEffect(() => {
    async function handleAuthCallback() {
      const code = searchParams.get("code");
      const next = searchParams.get("next") ?? "/draft";

      if (!code) {
        router.replace(next);
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        setMessage("Sign-in failed. Redirecting...");
        router.replace("/draft");
        return;
      }

      router.replace(next);
      router.refresh();
    }

    handleAuthCallback();
  }, [router, searchParams, supabase]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          757 MM Draft
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          Signing You In
        </h1>
        <p className="mt-3 text-sm text-slate-600">{message}</p>
      </div>
    </div>
  );
}