"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
};

export default function MobileNav() {
  const pathname = usePathname();

  const tabs: Tab[] = [
    { href: "/", label: "Home" },
    { href: "/scores", label: "Scores" },
    { href: "/bracket", label: "Bracket" },
    { href: "/rosters", label: "League" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800/90 bg-[#020817]/95 backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-7xl grid-cols-4 px-2 py-3">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/"
              ? pathname === "/"
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-1.5 transition"
            >
              <span
                className={`text-sm font-semibold ${
                  isActive ? "text-white" : "text-slate-500"
                }`}
              >
                {tab.label}
              </span>

              <span
                className={`h-1.5 w-10 rounded-full transition ${
                  isActive ? "bg-blue-400" : "bg-transparent"
                }`}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}