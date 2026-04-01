import DraftRoomHeader from '@/app/components/masters/DraftRoomHeader'
import EventHubNav from '@/app/components/masters/EventHubNav'
import { getRostersPageData } from '@/lib/golf/queries'

type PageProps = {
  params: Promise<{ leagueId: string }>
}

type RosterPlayer = {
  competitor_id: string
  player_name: string
  total_to_par: number | null
  today_to_par: number | null
  thru: string | null
  source: string | null
}

type RosterCard = {
  member_id: string
  display_name: string
  players: RosterPlayer[]
}

function formatToPar(value: number | null) {
  if (value == null) return '--'
  if (value === 0) return 'E'
  return value > 0 ? `+${value}` : `${value}`
}

export default async function MastersRostersPage({ params }: PageProps) {
  const { leagueId } = await params
  const { league, rosters } = await getRostersPageData(leagueId)

  return (
    <main className="min-h-screen bg-black px-4 py-4 text-white md:px-6 md:py-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 pb-24">
        <DraftRoomHeader
          leagueName={league?.name ?? 'Masters League'}
          eventName="Rosters"
          season={2026}
          status="live"
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {rosters.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 text-sm text-zinc-400">
              No roster data yet.
            </div>
          ) : (
            rosters.map((roster: RosterCard) => (
              <div
                key={roster.member_id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">
                    {roster.display_name}
                  </h2>
                  <span className="text-xs text-zinc-500">
                    {roster.players.length} players
                  </span>
                </div>

                <div className="space-y-2">
                  {roster.players.map((player: RosterPlayer) => (
                    <div
                      key={player.competitor_id}
                      className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"
                    >
                      <p className="text-sm font-semibold text-white">
                        {player.player_name}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        Total {formatToPar(player.total_to_par)} • Today {formatToPar(player.today_to_par)} • Thru {player.thru ?? '--'}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-500">
                        Source: {player.source ?? 'n/a'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <EventHubNav leagueId={leagueId} />
    </main>
  )
}