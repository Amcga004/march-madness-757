"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import type { User } from "@supabase/supabase-js";

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) return null;

  if (user) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{
          fontSize: "12px",
          color: "var(--color-text-secondary)",
        }}>
          {user.email?.split("@")[0]}
        </span>
        <button
          onClick={signOut}
          style={{
            fontSize: "12px",
            color: "var(--color-text-secondary)",
            background: "none",
            border: "0.5px solid var(--color-border-secondary)",
            borderRadius: "5px",
            padding: "4px 10px",
            cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <a
      href="/login"
      style={{
        fontSize: "12px",
        fontWeight: 500,
        color: "#EA6C0A",
        textDecoration: "none",
        border: "0.5px solid #EA6C0A60",
        borderRadius: "5px",
        padding: "4px 12px",
        background: "#EA6C0A10",
      }}
    >
      Sign in
    </a>
  );
}
