"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthUser = {
  id: string;
  email?: string;
} | null;

type Member = {
  id: string;
  display_name: string;
  role: string | null;
  user_id: string | null;
};

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/rosters", label: "Rosters" },
  { href: "/draft", label: "Draft Room" },
  { href: "/data", label: "Data" },
  { href: "/history", label: "Results" },
  { href: "/bracket", label: "Bracket" },
  { href: "/admin", label: "Admin", admin: true },
];

export default function HeaderMenu() {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function loadAuthState() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setAuthUser(user ? { id: user.id, email: user.email } : null);

      if (!user) {
        setMember(null);
        setAuthLoaded(true);
        return;
      }

      const { data: memberData } = await supabase
        .from("league_members")
        .select("id,display_name,role,user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      setMember((memberData as Member | null) ?? null);
      setAuthLoaded(true);
    }

    loadAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadAuthState();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setOpen(false);
    window.location.href = "/";
  }

  const signedInLabel = member
    ? `${member.display_name} • ${member.role ?? "manager"}`
    : authUser?.email ?? null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label="Open navigation menu"
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-white transition hover:border-slate-500 hover:bg-slate-800"
      >
        <span className="flex flex-col gap-1">
          <span className="block h-0.5 w-5 rounded bg-white" />
          <span className="block h-0.5 w-5 rounded bg-white" />
          <span className="block h-0.5 w-5 rounded bg-white" />
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 top-14 z-50 w-64 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/98 p-2 shadow-2xl backdrop-blur">
          <div className="mb-2 px-3 pt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Navigate
          </div>

          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  link.admin
                    ? "border border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                    : "text-slate-100 hover:bg-slate-900"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="my-3 border-t border-slate-800" />

          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Account
          </div>

          {authLoaded && signedInLabel ? (
            <div className="px-3 pb-2 text-sm text-slate-300">{signedInLabel}</div>
          ) : null}

          <div className="flex flex-col gap-1">
            {!authUser ? (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-900"
              >
                Login
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-100 transition hover:bg-slate-900"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}