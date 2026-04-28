import DraftRoomHeader from '@/app/components/masters/DraftRoomHeader'
import EventHubNav from '@/app/components/masters/EventHubNav'
import LiveFantasyLeaderboardTable from '@/app/components/masters/LiveFantasyLeaderboardTable'
import { getLeaderboardPageData } from '@/lib/golf/queries'

type PageProps = {
  params: Promise<{ leagueId: string }>
}

export default async function MastersLeaderboardPage({ params }: PageProps) {
  const { leagueId } = await params
  const { league, rows, eventStartsAt } = await getLeaderboardPageData(leagueId)

  const tournamentStarted = eventStartsAt
    ? new Date(eventStartsAt) <= new Date()
    : true

  return (
    <main className="min-h-screen bg-transparent px-3 py-3 text-[#162317] md:px-6 md:py-5">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 pb-24 md:gap-4">
        <DraftRoomHeader
          leagueName={league?.name ?? 'Masters League'}
          eventName="Live Tournament Leaderboard"
          season={2026}
          status={league?.draft_status ?? 'live'}
        />

        {!tournamentStarted ? (
          <div className="rounded-2xl border border-[#d9ddcf] bg-white p-8 text-center shadow-[0_4px_12px_rgba(16,24,40,0.04)]">
            <span className="mb-3 block text-3xl">⛳</span>
            <p className="text-base font-semibold text-[#162317]">Tournament hasn't started yet</p>
            {eventStartsAt && (
              <p className="mt-1 text-sm text-[#6f7a67]">
                Leaderboard goes live on{' '}
                {new Date(eventStartsAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                  timeZone: 'America/New_York',
                })}
              </p>
            )}
          </div>
        ) : (
          <LiveFantasyLeaderboardTable leagueId={leagueId} rows={rows} />
        )}
      </div>

      <EventHubNav leagueId={leagueId} />
    </main>
  )
}