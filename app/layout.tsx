import "./globals.css";
import Link from "next/link";
import LeaderboardBar from "./components/LeaderboardBar";

export const metadata = {
  title: "2026 757 March Madness Draft",
  description: "Private March Madness snake draft league",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900">
        <header className="border-b bg-white shadow-sm">
          <div className="mx-auto max-w-7xl px-6 py-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-bold">
                  2026 757 March Madness Draft
                </h1>
                <p className="text-sm text-gray-600">
                  Live draft, standings, rosters, and results
                </p>
              </div>

              <nav className="flex flex-wrap gap-3 text-sm">
                <Link
                  href="/"
                  className="rounded-xl border bg-white px-4 py-2 hover:bg-slate-50"
                >
                  Dashboard
                </Link>

                <Link
                  href="/rosters"
                  className="rounded-xl border bg-white px-4 py-2 hover:bg-slate-50"
                >
                  Rosters
                </Link>

                <Link
                  href="/draft"
                  className="rounded-xl border bg-white px-4 py-2 hover:bg-slate-50"
                >
                  Draft Room
                </Link>

                <Link
                  href="/history"
                  className="rounded-xl border bg-white px-4 py-2 hover:bg-slate-50"
                >
                  Results
                </Link>

                <Link
                  href="/bracket"
                  className="rounded-xl border bg-white px-4 py-2 hover:bg-slate-50"
                >
                  Bracket
                </Link>

                <Link
                  href="/admin"
                  className="rounded-xl border bg-white px-4 py-2 hover:bg-slate-50"
                >
                  Admin
                </Link>
              </nav>
            </div>
          </div>
        </header>

        <LeaderboardBar />

        <main>{children}</main>
      </body>
    </html>
  );
}