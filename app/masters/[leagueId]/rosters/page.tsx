import Link from 'next/link'
import DraftRoomHeader from '@/app/components/masters/DraftRoomHeader'
import EventHubNav from '@/app/components/masters/EventHubNav'
import { createClient } from '@/lib/supabase/server'
import { getManagerTheme } from '@/app/components/masters/managerTheme'

type PageProps = {
  params: Promise<{ leagueId: string }>
}

type GenericRow = Record<string, unknown>

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function formatToPar(value: number | null) {
  if (value == null) return 'E'
  if (value === 0) return 'E'
  return value > 0 ? `+${value}` : `${value}`
}

function formatFantasyPoints(value: number | null | undefined) {
  if (value == null) return '0'
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(1)
}

function fantasyPointsClass(value: number | null | undefined) {
  if (value == null || value === 0) return 'text-[#425040]'
  return value > 0 ? 'text-[#0b8f55]' : 'text-[#c23b3b]'
}

export default async function MastersRostersPage({ params }: PageProps) {
  const { leagueId } = await params
  const supabase = await createClient()

  const [{ data: leagueData }, { data: draftOrderRows }, { data: draftedRows }] =
    await Promise.all([
      supabase
        .from('leagues_v2')
        .select('id, name, event_id, draft_status, roster_size, max_members')
        .eq('id', leagueId)
        .maybeSingle(),
      supabase
        .from('league_draft_order_v2')
        .select('user_id, display_name, draft_position')
        .eq('league_id', leagueId)
        .order('draft_position', { ascending: true }),
      supabase
        .from('drafted_board_v2')
        .select('*')
        .eq('league_id', leagueId)
        .order('overall_pick', { ascending: true }),
    ])

  if (!leagueData) {
    return (
      <main className="min-h-screen bg-[#f3f1ea] px-4 py-4 text-[#162317] md:px-6 md:py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 pb-24">
          <div className="rounded-[22px] border border-[#d9ddcf] bg-white p-6 shadow-[0_10px_24px_rgba(16,24,40,0.06)]">
            <h1 className="text-2xl font-semibold">League not found</h1>
            <p className="mt-2 text-[#667065]">
              We couldn’t find a Masters league for that ID.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const draftOrder = (draftOrderRows ?? []).map((row) => ({
    user_id: row.user_id,
    display_name: row.display_name,
    draft_position: row.draft_position,
  }))

  const rosterMap = new Map<
    string,
    {
      user_id: string
      display_name: string
      draft_position: number
      players: {
        competitor_id: string
        player_name: string
        overall_pick: number | null
        total_to_par: number | null
        today_to_par: number | null
        thru: string | null
        status: string | null
        fantasy_points: number
      }[]
    }
  >()

  for (const manager of draftOrder) {
    rosterMap.set(manager.user_id, {
      user_id: manager.user_id,
      display_name: manager.display_name,
      draft_position: manager.draft_position,
      players: [],
    })
  }

  const draftedBoard = (draftedRows ?? []) as GenericRow[]
  const draftedCompetitorIds = draftedBoard
    .map((row) => asString(row.competitor_id))
    .filter((value): value is string => !!value)

  let liveStateMap = new Map<
    string,
    {
      total_to_par: number | null
      today_to_par: number | null
      thru: string | null
      status: string | null
    }
  >()

  if (leagueData.event_id && draftedCompetitorIds.length > 0) {
    const { data: liveRows } = await supabase
      .from('golf_live_player_state')
      .select('competitor_id, total_to_par, today_to_par, thru, status')
      .eq('event_id', leagueData.event_id)
      .in('competitor_id', draftedCompetitorIds)

    liveStateMap = new Map(
      (liveRows ?? []).map((row) => [
        row.competitor_id,
        {
          total_to_par: row.total_to_par ?? null,
          today_to_par: row.today_to_par ?? null,
          thru: row.thru ?? null,
          status: row.status ?? null,
        },
      ])
    )
  }

  for (const row of draftedBoard) {
    const competitorId = asString(row.competitor_id)
    const competitorName = asString(row.competitor_name)
    const draftPosition = asNumber(row.draft_position)
    const overallPick = asNumber(row.overall_pick)

    if (!competitorId || !competitorName || draftPosition == null) continue

    const owner = draftOrder.find((item) => item.draft_position === draftPosition)
    if (!owner) continue

    const live = liveStateMap.get(competitorId)
    const totalToPar = live?.total_to_par ?? null
    const fantasyPoints = totalToPar == null ? 0 : -1 * totalToPar

    rosterMap.get(owner.user_id)?.players.push({
      competitor_id: competitorId,
      player_name: competitorName,
      overall_pick: overallPick,
      total_to_par: totalToPar,
      today_to_par: live?.today_to_par ?? null,
      thru: live?.thru ?? null,
      status: live?.status ?? null,
      fantasy_points: fantasyPoints,
    })
  }

  const rosters = Array.from(rosterMap.values()).sort(
    (a, b) => a.draft_position - b.draft_position
  )

  return (
    <main className="min-h-screen bg-transparent px-2 py-3 text-[#162317] md:px-6 md:py-5">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 pb-24 md:gap-4">
        <DraftRoomHeader
          leagueName={leagueData.name ?? 'Masters League'}
          eventName="Manager Rosters"
          season={2026}
          status={leagueData.draft_status ?? 'live'}
        />

        <div className="space-y-3">
          {rosters.map((roster) => {
            const totalFantasyScore = roster.players.reduce(
              (sum, player) => sum + player.fantasy_points,
              0
            )

            const theme = getManagerTheme(roster.display_name)

            return (
              <details
                key={roster.user_id}
                open
                className="overflow-hidden rounded-[20px] border border-[#d9ddcf] bg-white shadow-[0_8px_20px_rgba(16,24,40,0.05)]"
              >
                <summary className="cursor-pointer list-none px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-[15px] font-semibold text-[#162317] md:text-lg">
                          {roster.display_name}
                        </h2>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${theme.softBadgeClass}`}>
                          Slot {roster.draft_position}
                        </span>
                      </div>

                      <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[#788274]">
                        Draft Position {roster.draft_position}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-[15px] font-semibold text-[#162317] md:text-lg">
                        {formatFantasyPoints(totalFantasyScore)} pts
                      </div>
                      <div className="text-[11px] text-[#788274]">
                        {roster.players.length}/{leagueData.roster_size ?? 12} drafted
                      </div>
                    </div>
                  </div>
                </summary>

                <div className="border-t border-[#e3e6da] bg-[#fafaf7]">
                  {roster.players.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-[#667065]">
                      No golfers drafted yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#edf0e8]">
                      {roster.players
                        .sort((a, b) => (a.overall_pick ?? 999) - (b.overall_pick ?? 999))
                        .map((player) => (
                          <div
                            key={player.competitor_id}
                            className="flex items-center justify-between gap-3 px-4 py-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold text-[#162317] md:text-sm">
                                {player.player_name}
                              </p>
                              <p className="mt-0.5 text-[11px] text-[#788274]">
                                Pick {player.overall_pick ?? '—'} • {formatToPar(player.total_to_par)} total •{' '}
                                {player.status ?? player.thru ?? 'No live data'}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <div className={`text-[12px] font-semibold ${fantasyPointsClass(player.fantasy_points)}`}>
                                  {formatFantasyPoints(player.fantasy_points)} pts
                                </div>
                              </div>

                              <Link
                                href={`/masters/${leagueId}/players/${player.competitor_id}`}
                                className="rounded-xl border border-[#d9ddcf] bg-white px-3 py-2 text-[11px] font-semibold text-[#243126] transition hover:bg-[#f7f7f1]"
                              >
                                Open
                              </Link>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </details>
            )
          })}
        </div>
      </div>

      <EventHubNav leagueId={leagueId} />
    </main>
  )
}