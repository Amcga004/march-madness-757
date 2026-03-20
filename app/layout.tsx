import "./globals.css";
import Link from "next/link";
import LeaderboardBar from "./components/LeaderboardBar";
import LiveNowBar from "./components/LiveNowBar";
import LeagueStatusBanner from "./components/LeagueStatusBanner";
import HeaderMenu from "./components/HeaderMenu";
import MobileNav from "./components/MobileNav";
import HideOnScores from "./components/HideOnScores";

export const metadata = {
  title: "757 MM Draft",
  description: "757 March Madness Snake Draft",
};

const desktopNavLinks = [
  { href: "/", label: "Home" },
  { href: "/scores", label: "Scores" },
  { href: "/bracket", label: "Bracket" },
  { href: "/rosters", label: "Rosters" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#081120] text-slate-100 antialiased">
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_28%),radial-gradient(circle_at_20%_30%,rgba(168,85,247,0.08),transparent_22%),linear-gradient(180deg,#030712_0%,#081120_35%,#0b1220_100%)]">
          <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#020817]/95 text-white shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <Link href="/" className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 text-2xl">🏀</span>
                    <div className="min-w-0">
                      <h1 className="truncate text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                        757 MM Draft
                      </h1>
                      <p className="hidden text-xs text-slate-400 sm:block">
                        March Madness fantasy draft
                      </p>
                    </div>
                  </div>
                </Link>

                <div className="hidden items-center gap-3 md:flex">
                  <nav className="flex items-center gap-2 rounded-2xl border border-slate-800/80 bg-[#0b1220]/80 px-2 py-2">
                    {desktopNavLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-[#172033] hover:text-white"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </nav>

                  <div className="shrink-0">
                    <HeaderMenu />
                  </div>
                </div>
              </div>
            </div>
          </header>

          <LeaderboardBar />

          <HideOnScores>
            <LiveNowBar />
          </HideOnScores>

          <LeagueStatusBanner />

          <main className="min-h-[calc(100vh-160px)] pb-24 md:pb-8">{children}</main>

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