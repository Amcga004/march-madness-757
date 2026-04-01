import Link from 'next/link'
import DraftRoomHeader from '@/app/components/masters/DraftRoomHeader'
import EventHubNav from '@/app/components/masters/EventHubNav'
import { createClient } from '@/lib/supabase/server'

type PageProps = {
  params: Promise<{ leagueId: string; competitorId: string }>
}

type LiveStateRow = {
  competitor_id: string
  position_text: string | null
  total_to_par: number | null
  today_to_par: number | null
  thru: string | null
  status: string | null
}

type HoleRow = {
  id: string
  event_id: string
  competitor_id: string
  round_number: number
  hole_number: number
  player_name: string | null
  par: number | null
  strokes: number | null
  score_to_par_on_hole: number | null
  cumulative_to_par: number | null
  thru: number | null
  hole_status: string | null
  round_status: string | null
  source: string | null
  source_updated_at: string | null
  created_at: string
  updated_at: string
}

type DraftPickRow = {
  display_name: string | null
}

type PlayerFantasyRow = {
  fantasy_points_total: number
  today_points: number
  made_cut_bonus: number
  placement_bonus: number
  round_1_points: number
  round_2_points: number
  round_3_points: number
  round_4_points: number
  cut_status: string | null
  cut_bonus: number
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

export default async function MastersPlayerDetailPage({ params }: PageProps) {
  const { leagueId, competitorId } = await params
  const supabase = await createClient()

  const [{ data: leagueData }, { data: competitorData }] = await Promise.all([
    supabase
      .from('leagues_v2')
      .select('id, name, event_id, draft_status')
      .eq('id', leagueId)
      .maybeSingle(),
    supabase
      .from('competitors')
      .select('id, name, short_name')
      .eq('id', competitorId)
      .maybeSingle(),
  ])

  if (!leagueData || !competitorData) {
    return (
      <main className="min-h-screen bg-black px-4 py-4 text-white md:px-6 md:py-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 pb-24">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
            <h1 className="text-2xl font-bold">Player not found</h1>
            <p className="mt-2 text-zinc-400">
              We couldn’t load that golfer for this league.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const liveStateResult = leagueData.event_id
    ? await supabase
        .from('golf_live_player_state')
        .select(
          'competitor_id, position_text, total_to_par, today_to_par, thru, status'
        )
        .eq('event_id', leagueData.event_id)
        .eq('competitor_id', competitorId)
        .maybeSingle()
    : { data: null, error: null }

  const holeRowsResult = leagueData.event_id
    ? await supabase
        .from('golf_live_player_holes')
        .select('*')
        .eq('event_id', leagueData.event_id)
        .eq('competitor_id', competitorId)
        .order('round_number', { ascending: true })
        .order('hole_number', { ascending: true })
    : { data: [], error: null }

  const draftPickResult = await supabase
    .from('drafted_board_v2')
    .select('display_name')
    .eq('league_id', leagueId)
    .eq('competitor_id', competitorId)
    .limit(1)

  const playerFantasyResult = await supabase
    .from('golf_live_player_fantasy_scores')
    .select(
      'fantasy_points_total, today_points, made_cut_bonus, placement_bonus, round_1_points, round_2_points, round_3_points, round_4_points, cut_status, cut_bonus'
    )
    .eq('league_id', leagueId)
    .eq('competitor_id', competitorId)
    .maybeSingle()

  const liveState = (liveStateResult.data ?? null) as LiveStateRow | null
  const holeRows = (holeRowsResult.data ?? []) as HoleRow[]
  const draftPickRows = (draftPickResult.data ?? []) as DraftPickRow[]
  const playerFantasy = (playerFantasyResult.data ?? null) as PlayerFantasyRow | null

  const draftedBy = draftPickRows[0]?.display_name ?? null
  const fantasyPoints =
    playerFantasy?.fantasy_points_total ??
    (liveState?.total_to_par == null ? 0 : -1 * liveState.total_to_par)

  const roundsMap = new Map<number, HoleRow[]>()

  for (const row of holeRows) {
    const roundNumber = row.round_number ?? 1
    if (!roundsMap.has(roundNumber)) {
      roundsMap.set(roundNumber, [])
    }
    roundsMap.get(roundNumber)!.push(row)
  }

  const rounds = Array.from(roundsMap.entries()).sort((a, b) => a[0] - b[0])

  return (
    <main className="min-h-screen bg-black px-4 py-4 text-white md:px-6 md:py-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 pb-24">
        <DraftRoomHeader
          leagueName={leagueData.name ?? 'Masters League'}
          eventName={competitorData.name}
          season={2026}
          status={leagueData.draft_status ?? 'live'}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/masters/${leagueId}/rosters`}
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm text-white transition hover:bg-zinc-900"
          >
            Back to Rosters
          </Link>
        </div>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{competitorData.name}</h1>
              <p className="mt-2 text-sm text-zinc-400">
                {draftedBy ? `Drafted by ${draftedBy}` : 'Not drafted'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                  Position
                </div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {liveState?.position_text ?? '—'}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                  Total
                </div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {formatToPar(liveState?.total_to_par ?? null)}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                  Today
                </div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {formatToPar(liveState?.today_to_par ?? null)}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                  Fantasy
                </div>
                <div className="mt-1 text-lg font-bold text-emerald-400">
                  {formatFantasyPoints(fantasyPoints)}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                  Status
                </div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {liveState?.status ?? liveState?.thru ?? 'No live data'}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          <h2 className="text-lg font-semibold text-white">Fantasy Breakdown</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                Today Points
              </div>
              <div className="mt-2 text-lg font-bold text-emerald-400">
                {formatFantasyPoints(playerFantasy?.today_points ?? 0)}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                Cut Bonus
              </div>
              <div className="mt-2 text-lg font-bold text-emerald-400">
                {formatFantasyPoints(playerFantasy?.cut_bonus ?? 0)}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {playerFantasy?.cut_status ?? 'Pending'}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                Placement Bonus
              </div>
              <div className="mt-2 text-lg font-bold text-emerald-400">
                {formatFantasyPoints(playerFantasy?.placement_bonus ?? 0)}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                Total Fantasy
              </div>
              <div className="mt-2 text-lg font-bold text-emerald-400">
                {formatFantasyPoints(playerFantasy?.fantasy_points_total ?? fantasyPoints)}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Round 1</div>
              <div className="mt-2 text-base font-semibold text-white">
                {formatFantasyPoints(playerFantasy?.round_1_points ?? 0)}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Round 2</div>
              <div className="mt-2 text-base font-semibold text-white">
                {formatFantasyPoints(playerFantasy?.round_2_points ?? 0)}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Round 3</div>
              <div className="mt-2 text-base font-semibold text-white">
                {formatFantasyPoints(playerFantasy?.round_3_points ?? 0)}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Round 4</div>
              <div className="mt-2 text-base font-semibold text-white">
                {formatFantasyPoints(playerFantasy?.round_4_points ?? 0)}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          <h2 className="text-lg font-semibold text-white">Round Scorecards</h2>

          {rounds.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">
              Hole-by-hole scoring will populate here once live hole data is available.
            </p>
          ) : (
            <div className="mt-4 space-y-6">
              {rounds.map(([roundNumber, holes]) => (
                <div key={roundNumber} className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-300">
                    Round {roundNumber}
                  </h3>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {holes.map((hole) => (
                      <div
                        key={`${roundNumber}-${hole.hole_number}`}
                        className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-white">
                            Hole {hole.hole_number}
                          </div>
                          <div className="text-xs text-zinc-500">
                            Par {hole.par ?? '—'}
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <div className="text-zinc-500">Strokes</div>
                            <div className="mt-1 font-semibold text-white">
                              {hole.strokes ?? '—'}
                            </div>
                          </div>

                          <div>
                            <div className="text-zinc-500">Hole Score</div>
                            <div className="mt-1 font-semibold text-white">
                              {formatToPar(hole.score_to_par_on_hole ?? null)}
                            </div>
                          </div>

                          <div>
                            <div className="text-zinc-500">Cumulative</div>
                            <div className="mt-1 font-semibold text-white">
                              {formatToPar(hole.cumulative_to_par ?? null)}
                            </div>
                          </div>

                          <div>
                            <div className="text-zinc-500">Status</div>
                            <div className="mt-1 font-semibold text-white">
                              {hole.hole_status ?? hole.round_status ?? '—'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <EventHubNav leagueId={leagueId} />
    </main>
  )
}