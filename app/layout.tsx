import "./globals.css";
import Link from "next/link";
import LeaderboardBar from "./components/LeaderboardBar";

export const metadata = {
  title: "757 MM Draft",
  description: "757 March Madness Snake Draft",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="text-slate-900">
        <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 text-white shadow-lg backdrop-blur">
          <div className="mx-auto max-w-7xl px-6 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏀</span>
                  <h1 className="text-2xl font-extrabold tracking-tight">
                    757 MM Draft
                  </h1>
                </div>
                <p className="mt-1 text-sm text-slate-300">
                  Live standings, draft board, rosters, results, and bracket
                </p>
              </div>

              <nav className="flex flex-wrap gap-2 text-sm">
                <Link
                  href="/"
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 transition hover:border-slate-500 hover:bg-slate-800"
                >
                  Dashboard
                </Link>

                <Link
                  href="/rosters"
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 transition hover:border-slate-500 hover:bg-slate-800"
                >
                  Rosters
                </Link>

                <Link
                  href="/draft"
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 transition hover:border-slate-500 hover:bg-slate-800"
                >
                  Draft Room
                </Link>

                <Link
                  href="/history"
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 transition hover:border-slate-500 hover:bg-slate-800"
                >
                  Results
                </Link>

                <Link
                  href="/bracket"
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 transition hover:border-slate-500 hover:bg-slate-800"
                >
                  Bracket
                </Link>

                <Link
                  href="/admin"
                  className="rounded-xl border border-amber-500/60 bg-amber-500/10 px-4 py-2 transition hover:bg-amber-500/20"
                >
                  Admin
                </Link>
              </nav>
            </div>
          </div>
        </header>

        <LeaderboardBar />

        <main>{children}</main>

        <footer className="mt-10 border-t border-slate-200 bg-white/70 backdrop-blur">
          <div className="mx-auto max-w-7xl px-6 py-4 text-center text-sm text-slate-500">
            757 MM Draft • Built for annual March Madness competition
          </div>
        </footer>
      </body>
    </html>
  );
}