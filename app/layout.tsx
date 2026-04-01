import './globals.css'
import LeaderboardBar from './components/LeaderboardBar'
import LiveNowBar from './components/LiveNowBar'
import LeagueStatusBanner from './components/LeagueStatusBanner'
import MobileNav from './components/MobileNav'
import HideOnScores from './components/HideOnScores'
import HideOnMasters from './components/HideOnMasters'
import AppHeader from './components/AppHeader'

export const metadata = {
  title: '757 MM Draft',
  description: '757 March Madness Snake Draft',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#081120] text-slate-100 antialiased">
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_28%),radial-gradient(circle_at_20%_30%,rgba(168,85,247,0.08),transparent_22%),linear-gradient(180deg,#030712_0%,#081120_35%,#0b1220_100%)]">
          <AppHeader />

          <HideOnMasters>
            <LeaderboardBar />

            <HideOnScores>
              <LiveNowBar />
            </HideOnScores>

            <LeagueStatusBanner />
          </HideOnMasters>

          <main className="min-h-[calc(100vh-160px)] pb-24 md:pb-8">{children}</main>

          <HideOnMasters>
            <footer className="mt-8 hidden border-t border-slate-800/80 bg-[#020817]/80 backdrop-blur md:block">
              <div className="mx-auto max-w-7xl px-4 py-4 text-center text-sm text-slate-400 sm:px-6">
                757 MM Draft • Built for annual March Madness competition
              </div>
            </footer>

            <MobileNav />
          </HideOnMasters>
        </div>
      </body>
    </html>
  )
}