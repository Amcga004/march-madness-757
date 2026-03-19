import "./globals.css";
import LeaderboardBar from "./components/LeaderboardBar";
import LiveNowBar from "./components/LiveNowBar";
import LeagueStatusBanner from "./components/LeagueStatusBanner";
import HeaderMenu from "./components/HeaderMenu";
import MobileNav from "./components/MobileNav";
import AutoRefreshClient from "./components/AutoRefreshClient";

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
      <body className="min-h-screen bg-[#081120] pb-24 text-slate-100 antialiased md:pb-0">
        <AutoRefreshClient intervalMs={5000} hiddenIntervalMs={20000} refreshOnFocus />

        <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_28%),radial-gradient(circle_at_20%_30%,rgba(168,85,247,0.08),transparent_22%),linear-gradient(180deg,#030712_0%,#081120_35%,#0b1220_100%)]">
          <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#020817]/95 text-white shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6 sm:py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 text-lg sm:text-2xl">🏀</span>
                    <div className="min-w-0">
                      <h1 className="truncate text-base font-extrabold tracking-tight text-white sm:text-2xl">
                        757 MM Draft
                      </h1>
                      <p className="hidden text-xs text-slate-400 sm:block">
                        March Madness fantasy draft
                      </p>
                    </div>
                  </div>
                </div>

                <div className="hidden md:block">
                  <HeaderMenu />
                </div>
              </div>
            </div>
          </header>

          <div className="sticky top-[57px] z-40 md:top-[73px]">
            <LeaderboardBar />
            <LiveNowBar />
            <LeagueStatusBanner />
          </div>

          <main className="min-h-[calc(100vh-120px)] pb-4 md:pb-8">
            {children}
          </main>

          <footer className="mt-8 hidden border-t border-slate-800/80 bg-[#020817]/80 backdrop-blur md:block">
            <div className="mx-auto max-w-7xl px-4 py-4 text-center text-sm text-slate-400 sm:px-6">
              757 MM Draft • Built for annual March Madness competition
            </div>
          </footer>

          <MobileNav />
        </div>
      </body>
    </html>
  );
}