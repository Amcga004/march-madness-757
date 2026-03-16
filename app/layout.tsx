import "./globals.css";
import LeaderboardBar from "./components/LeaderboardBar";
import LeagueStatusBanner from "./components/LeagueStatusBanner";
import HeaderMenu from "./components/HeaderMenu";

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
      <body className="bg-slate-100 text-slate-900 antialiased">
        <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 text-white shadow-lg backdrop-blur">
          <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className="shrink-0 text-2xl">🏀</span>
                  <div className="min-w-0">
                    <h1 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">
                      757 MM Draft
                    </h1>
                    <p className="hidden text-xs text-slate-400 sm:block">
                      March Madness fantasy draft
                    </p>
                  </div>
                </div>
              </div>

              <HeaderMenu />
            </div>
          </div>
        </header>

        <LeaderboardBar />

        <LeagueStatusBanner />

        <main className="min-h-[calc(100vh-180px)]">{children}</main>

        <footer className="mt-8 border-t border-slate-200 bg-white/80 backdrop-blur">
          <div className="mx-auto max-w-7xl px-4 py-4 text-center text-sm text-slate-500 sm:px-6">
            757 MM Draft • Built for annual March Madness competition
          </div>
        </footer>
      </body>
    </html>
  );
}