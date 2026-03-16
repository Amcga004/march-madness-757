import "./globals.css";
import Link from "next/link";
import LeaderboardBar from "./components/LeaderboardBar";
import LeagueStatusBanner from "./components/LeagueStatusBanner";

export const metadata = {
  title: "757 MM Draft",
  description: "757 March Madness Snake Draft",
};

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/rosters", label: "Rosters" },
  { href: "/draft", label: "Draft Room" },
  { href: "/data", label: "Data" },
  { href: "/history", label: "Results" },
  { href: "/bracket", label: "Bracket" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900 antialiased">
        <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 text-white shadow-lg backdrop-blur">
          <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 text-2xl sm:text-3xl">🏀</span>
                    <h1 className="truncate text-2xl font-extrabold tracking-tight sm:text-3xl">
                      757 MM Draft
                    </h1>
                  </div>

                  <p className="mt-1 max-w-2xl text-sm leading-snug text-slate-300 sm:text-sm">
                    <span className="sm:hidden">
                      Live standings, draft, rosters, results, bracket, analytics
                    </span>
                    <span className="hidden sm:inline">
                      Live standings, draft board, rosters, results, bracket, and analytics
                    </span>
                  </p>
                </div>
              </div>

              <nav
                className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
                aria-label="Primary"
              >
                <div className="flex min-w-max gap-2">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition hover:border-slate-500 hover:bg-slate-800"
                    >
                      {link.label}
                    </Link>
                  ))}

                  <Link
                    href="/admin"
                    className="rounded-xl border border-amber-500/60 bg-amber-500/10 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition hover:bg-amber-500/20"
                  >
                    Admin
                  </Link>
                </div>
              </nav>
            </div>
          </div>
        </header>

        <LeaderboardBar />

        <LeagueStatusBanner />

        <main className="min-h-[calc(100vh-220px)]">{children}</main>

        <footer className="mt-8 border-t border-slate-200 bg-white/80 backdrop-blur">
          <div className="mx-auto max-w-7xl px-4 py-4 text-center text-sm text-slate-500 sm:px-6">
            757 MM Draft • Built for annual March Madness competition
          </div>
        </footer>
      </body>
    </html>
  );
}