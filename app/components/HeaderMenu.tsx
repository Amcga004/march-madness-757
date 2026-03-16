"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

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
        <div className="absolute right-0 top-14 z-50 w-56 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/98 p-2 shadow-2xl backdrop-blur">
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
        </div>
      ) : null}
    </div>
  );
}