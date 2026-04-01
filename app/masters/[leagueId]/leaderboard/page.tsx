import DraftRoomHeader from '@/app/components/masters/DraftRoomHeader'
import EventHubNav from '@/app/components/masters/EventHubNav'
import LiveFantasyLeaderboardTable from '@/app/components/masters/LiveFantasyLeaderboardTable'
import { getLeaderboardPageData } from '@/lib/golf/queries'

type PageProps = {
  params: Promise<{ leagueId: string }>
}

export default async function MastersLeaderboardPage({ params }: PageProps) {
  const { leagueId } = await params
  const { league, rows } = await getLeaderboardPageData(leagueId)

  return (
    <main className="min-h-screen bg-transparent px-3 py-3 text-[#162317] md:px-6 md:py-5">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 pb-24 md:gap-4">
        <DraftRoomHeader
          leagueName={league?.name ?? 'Masters League'}
          eventName="Live Tournament Leaderboard"
          season={2026}
          status={league?.draft_status ?? 'live'}
        />

        <LiveFantasyLeaderboardTable leagueId={leagueId} rows={rows} />
      </div>

      <EventHubNav leagueId={leagueId} />
    </main>
  )
}