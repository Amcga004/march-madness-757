import Link from 'next/link'
import SportSwitcher from '@/app/components/SportSwitcher'
import MastersTopNav from '@/app/components/masters/MastersTopNav'
import HeaderMenu from '@/app/components/HeaderMenu'
import LiveAutoRefresh from '@/app/components/masters/LiveAutoRefresh'
import { createServiceClient } from '@/lib/supabase/service'

type LayoutProps = {
  children: React.ReactNode
  params: Promise<{ leagueId: string }>
}

export default async function MastersLeagueLayout({
  children,
  params,
}: LayoutProps) {
  const { leagueId } = await params

  const supabase = createServiceClient()
  const { data: leagueRow } = await supabase
    .from('leagues_v2')
    .select('name')
    .eq('id', leagueId)
    .maybeSingle()

  const leagueName = leagueRow?.name ?? 'Golf League'

  return (
    <div className="min-h-screen bg-[#f3f1ea] text-[#162317] antialiased">
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(11,93,59,0.06),transparent_28%),linear-gradient(180deg,#f6f4ed_0%,#f3f1ea_42%,#eeece3_100%)]">
        <LiveAutoRefresh leagueId={leagueId} intervalMs={60000} />

        <header className="sticky top-0 z-50 border-b border-[#d9ddcf] bg-[rgba(243,241,234,0.96)] text-[#162317] shadow-[0_8px_20px_rgba(16,24,40,0.06)] backdrop-blur-xl">
          <div className="mx-auto max-w-7xl px-3 py-2.5 sm:px-4 md:px-6">
            {/* Breadcrumb */}
            <nav className="mb-1.5 flex items-center gap-1 text-[10px] text-[#9aa89a]">
              <Link href="/betting" className="hover:text-[#162317] transition-colors">EdgePulse</Link>
              <span>›</span>
              <Link href="/fantasy" className="hover:text-[#162317] transition-colors">Fantasy</Link>
              <span>›</span>
              <Link href="/fantasy/golf" className="hover:text-[#162317] transition-colors">Golf</Link>
              <span>›</span>
              <span className="truncate font-medium text-[#162317]">{leagueName}</span>
            </nav>

            <div className="flex items-center justify-between gap-3">
              <Link href={`/masters/${leagueId}/hub`} className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="shrink-0 text-xl md:text-2xl">⛳</span>
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#6f7a67]">
                      757 Fantasy
                    </p>
                    <h1 className="truncate text-[15px] font-semibold tracking-tight text-[#162317] md:text-[20px] md:font-extrabold">
                      {leagueName}
                    </h1>
                    <p className="hidden text-xs text-[#788274] sm:block">
                      PGA Golf Fantasy
                    </p>
                  </div>
                </div>
              </Link>

              <div className="hidden items-center gap-3 md:flex">
                <SportSwitcher mastersLeagueId={leagueId} />
                <MastersTopNav />
                <div className="shrink-0">
                  <HeaderMenu />
                </div>
              </div>

              <div className="flex items-center gap-2 md:hidden">
                <SportSwitcher mastersLeagueId={leagueId} />
                <HeaderMenu />
              </div>
            </div>

            <div className="mt-2 flex gap-2 overflow-x-auto pb-0.5 md:hidden">
              <Link
                href={`/masters/${leagueId}/hub`}
                className="whitespace-nowrap rounded-full border border-[#d9ddcf] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#243126]"
              >
                Hub
              </Link>
              <Link
                href={`/masters/${leagueId}/leaderboard`}
                className="whitespace-nowrap rounded-full border border-[#d9ddcf] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#243126]"
              >
                Leaderboard
              </Link>
              <Link
                href={`/masters/${leagueId}/rosters`}
                className="whitespace-nowrap rounded-full border border-[#d9ddcf] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#243126]"
              >
                Rosters
              </Link>
              <Link
                href={`/masters/${leagueId}/draft`}
                className="whitespace-nowrap rounded-full border border-[#d9ddcf] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#243126]"
              >
                Draft
              </Link>
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-88px)] pb-24 md:pb-8">{children}</main>
      </div>
    </div>
  )
}