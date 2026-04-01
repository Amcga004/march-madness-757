import { createClient } from '@/lib/supabase/server'

type LiveStateRow = {
  competitor_id: string
  total_to_par: number | null
  today_to_par?: number | null
  thru: string | number | null
  status: string | null
  current_round?: number | null
}

type RoundResultRow = {
  competitor_id: string
  round_number: number
  score_to_par: number | null
  is_final: boolean | null
}

type EventResultRow = {
  competitor_id: string
  position: number | null
  made_cut: boolean | null
}

type EventRow = {
  id: string
  status: string | null
}

function normalizeThruValue(value: string | number | null | undefined): string | null {
  if (value == null) return null
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string' && value.trim()) return value.trim()
  return null
}

function isFinished(
  status: string | null | undefined,
  thru: string | number | null | undefined
): boolean {
  const normalizedStatus = status?.toLowerCase() ?? ''
  const normalizedThru = normalizeThruValue(thru)?.toLowerCase() ?? ''

  return (
    normalizedStatus.includes('final') ||
    normalizedStatus.includes('finished') ||
    normalizedThru === 'f'
  )
}

function isThrough(thru: string | number | null | undefined): boolean {
  const normalizedThru = normalizeThruValue(thru)
  return !!normalizedThru
}

function deriveCutStatus(madeCut: boolean | null | undefined): string | null {
  if (madeCut === true) return 'made_cut'
  if (madeCut === false) return 'missed_cut'
  return null
}

function roundFantasyPoints(scoreToPar: number | null | undefined): number {
  if (scoreToPar == null) return 0
  const pts = -1 * scoreToPar
  return pts < -5 ? -5 : pts
}

function finishBonus(position: number | null | undefined, eventStatus: string | null | undefined) {
  if ((eventStatus ?? '').toLowerCase() !== 'completed') return 0
  if (position == null) return 0
  if (position === 1) return 20
  if (position === 2) return 15
  if (position >= 3 && position <= 5) return 10
  if (position >= 6 && position <= 10) return 5
  if (position >= 11 && position <= 20) return 3
  return 0
}

function cutBonus(madeCut: boolean | null | undefined) {
  if (madeCut === true) return 2
  if (madeCut === false) return -3
  return 0
}

export async function refreshLiveManagerScores(leagueId: string, eventId: string) {
  const supabase = await createClient()

  const [
    { data: eventRow, error: eventError },
    { data: draftBoardRaw, error: draftBoardError },
    { data: orderRows, error: orderError },
    { data: liveRows, error: liveRowsError },
    { data: roundRows, error: roundRowsError },
    { data: eventResultsRows, error: eventResultsError },
  ] = await Promise.all([
    supabase.from('events').select('id, status').eq('id', eventId).maybeSingle(),

    supabase
      .from('drafted_board_v2')
      .select('league_id, draft_position, display_name, competitor_id, competitor_name')
      .eq('league_id', leagueId),

    supabase
      .from('league_draft_order_v2')
      .select('league_id, user_id, display_name, draft_position')
      .eq('league_id', leagueId)
      .order('draft_position', { ascending: true }),

    supabase
      .from('golf_live_player_state')
      .select('competitor_id, total_to_par, today_to_par, thru, status, current_round')
      .eq('event_id', eventId),

    supabase
      .from('golf_round_results')
      .select('competitor_id, round_number, score_to_par, is_final')
      .eq('event_id', eventId),

    supabase
      .from('golf_event_results')
      .select('competitor_id, position, made_cut')
      .eq('event_id', eventId),
  ])

  if (eventError) throw new Error(`Unable to load event: ${eventError.message}`)
  if (draftBoardError) throw new Error(`Unable to load draft board: ${draftBoardError.message}`)
  if (orderError) throw new Error(`Unable to load draft order: ${orderError.message}`)
  if (liveRowsError) throw new Error(`Unable to load live rows: ${liveRowsError.message}`)
  if (roundRowsError) throw new Error(`Unable to load round rows: ${roundRowsError.message}`)
  if (eventResultsError) {
    throw new Error(`Unable to load event results: ${eventResultsError.message}`)
  }

  const eventStatus = (eventRow as EventRow | null)?.status ?? null

  const liveMap = new Map<string, LiveStateRow>()
  for (const row of (liveRows ?? []) as LiveStateRow[]) {
    liveMap.set(row.competitor_id, row)
  }

  const eventResultMap = new Map<string, EventResultRow>()
  for (const row of (eventResultsRows ?? []) as EventResultRow[]) {
    eventResultMap.set(row.competitor_id, row)
  }

  const finalizedRoundsMap = new Map<string, RoundResultRow[]>()
  for (const row of (roundRows ?? []) as RoundResultRow[]) {
    if (!row.is_final) continue
    const existing = finalizedRoundsMap.get(row.competitor_id) ?? []
    existing.push(row)
    finalizedRoundsMap.set(row.competitor_id, existing)
  }

  const managerMap = new Map<
    string,
    {
      league_id: string
      member_id: string
      display_name: string
      fantasy_points: number
      golfers_thru: number
      golfers_finished: number
    }
  >()

  const draftPositionToUserMap = new Map<number, { user_id: string; display_name: string }>()

  for (const row of orderRows ?? []) {
    draftPositionToUserMap.set(row.draft_position, {
      user_id: row.user_id,
      display_name: row.display_name,
    })

    managerMap.set(row.user_id, {
      league_id: leagueId,
      member_id: row.user_id,
      display_name: row.display_name,
      fantasy_points: 0,
      golfers_thru: 0,
      golfers_finished: 0,
    })
  }

  const playerFantasyPayload: Array<{
    league_id: string
    event_id: string
    competitor_id: string
    manager_user_id: string | null
    manager_display_name: string | null
    player_name: string | null
    total_to_par: number | null
    today_to_par: number | null
    thru: string | null
    status: string | null
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
    updated_at: string
  }> = []

  for (const row of draftBoardRaw ?? []) {
    const draftPosition = row.draft_position
    const competitorId = row.competitor_id
    const competitorName = row.competitor_name ?? null

    if (typeof draftPosition !== 'number' || !competitorId) continue

    const owner = draftPositionToUserMap.get(draftPosition)
    const live = liveMap.get(competitorId)
    const eventResult = eventResultMap.get(competitorId)
    const finalizedRounds = (finalizedRoundsMap.get(competitorId) ?? []).sort(
      (a, b) => a.round_number - b.round_number
    )

    const roundPointMap = new Map<number, number>()
    for (const round of finalizedRounds) {
      roundPointMap.set(round.round_number, roundFantasyPoints(round.score_to_par))
    }

    const currentRound = live?.current_round ?? null
    const finalizedRoundCount = finalizedRounds.length

    let liveCurrentRoundPoints = 0
    if (
      currentRound &&
      currentRound >= 1 &&
      currentRound <= 4 &&
      !roundPointMap.has(currentRound)
    ) {
      liveCurrentRoundPoints = roundFantasyPoints(live?.today_to_par ?? 0)
    }

    const round1Points = roundPointMap.get(1) ?? 0
    const round2Points = roundPointMap.get(2) ?? 0
    const round3Points = roundPointMap.get(3) ?? 0
    const round4Points = roundPointMap.get(4) ?? 0

    const appliedCutBonus =
      finalizedRoundCount >= 2 || eventResult?.made_cut != null ? cutBonus(eventResult?.made_cut) : 0

    const appliedFinishBonus = finishBonus(eventResult?.position, eventStatus)

    const totalFantasyPoints =
      round1Points +
      round2Points +
      round3Points +
      round4Points +
      liveCurrentRoundPoints +
      appliedCutBonus +
      appliedFinishBonus

    playerFantasyPayload.push({
      league_id: leagueId,
      event_id: eventId,
      competitor_id: competitorId,
      manager_user_id: owner?.user_id ?? null,
      manager_display_name: owner?.display_name ?? null,
      player_name: competitorName,
      total_to_par: live?.total_to_par ?? null,
      today_to_par: live?.today_to_par ?? null,
      thru: normalizeThruValue(live?.thru),
      status: live?.status ?? null,
      fantasy_points_total: totalFantasyPoints,
      today_points: liveCurrentRoundPoints,
      made_cut_bonus: appliedCutBonus > 0 ? appliedCutBonus : 0,
      placement_bonus: appliedFinishBonus,
      round_1_points: round1Points,
      round_2_points: round2Points,
      round_3_points: round3Points,
      round_4_points: round4Points,
      cut_status: deriveCutStatus(eventResult?.made_cut),
      cut_bonus: appliedCutBonus,
      updated_at: new Date().toISOString(),
    })

    if (!owner) continue

    const manager = managerMap.get(owner.user_id)
    if (!manager) continue

    manager.fantasy_points += totalFantasyPoints

    if (isThrough(live?.thru)) {
      manager.golfers_thru += 1
    }

    if (isFinished(live?.status, live?.thru)) {
      manager.golfers_finished += 1
    }
  }

  const managerPayload = Array.from(managerMap.values()).map((row) => ({
    ...row,
    updated_at: new Date().toISOString(),
  }))

  const { error: deletePlayerError } = await supabase
    .from('golf_live_player_fantasy_scores')
    .delete()
    .eq('league_id', leagueId)

  if (deletePlayerError) {
    throw new Error(`Unable to clear player fantasy scores: ${deletePlayerError.message}`)
  }

  const { error: deleteManagerError } = await supabase
    .from('golf_live_manager_scores')
    .delete()
    .eq('league_id', leagueId)

  if (deleteManagerError) {
    throw new Error(`Unable to clear manager fantasy scores: ${deleteManagerError.message}`)
  }

  if (playerFantasyPayload.length > 0) {
    const { error: insertPlayerError } = await supabase
      .from('golf_live_player_fantasy_scores')
      .insert(playerFantasyPayload)

    if (insertPlayerError) {
      throw new Error(`Unable to insert player fantasy scores: ${insertPlayerError.message}`)
    }
  }

  if (managerPayload.length > 0) {
    const { error: insertManagerError } = await supabase
      .from('golf_live_manager_scores')
      .insert(managerPayload)

    if (insertManagerError) {
      throw new Error(`Unable to insert manager scores: ${insertManagerError.message}`)
    }
  }

  return {
    managerRowCount: managerPayload.length,
    playerRowCount: playerFantasyPayload.length,
  }
}