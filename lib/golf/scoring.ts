import { createClient } from '@/lib/supabase/server'

type LiveStateRow = {
  competitor_id: string
  total_to_par: number | null
  today_to_par?: number | null
  thru: string | number | null
  status: string | null
}

type FantasyTotalsRow = {
  competitor_id: string
  round_points: number | null
  cut_bonus: number | null
  finish_bonus: number | null
  total_fantasy_points: number | null
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

function deriveCutStatus(status: string | null | undefined): string | null {
  const normalized = status?.toLowerCase() ?? ''

  if (!normalized) return null
  if (normalized.includes('cut')) return 'cut'
  if (normalized.includes('final') || normalized.includes('finished')) {
    return 'made_cut_or_finished'
  }

  return null
}

function todayPointsFromToPar(todayToPar: number | null | undefined): number {
  if (todayToPar == null) return 0

  const pts = -1 * todayToPar
  return pts < -5 ? -5 : pts
}

function livePointsFromTotalToPar(totalToPar: number | null | undefined): number {
  if (totalToPar == null) return 0
  return -1 * totalToPar
}

export async function refreshLiveManagerScores(leagueId: string, eventId: string) {
  const supabase = await createClient()

  const [
    { data: draftBoardRaw, error: draftBoardError },
    { data: orderRows, error: orderError },
    { data: liveRows, error: liveRowsError },
    { data: fantasyTotalsRows, error: fantasyTotalsError },
  ] = await Promise.all([
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
      .select('competitor_id, total_to_par, today_to_par, thru, status')
      .eq('event_id', eventId),

    supabase
      .from('golf_event_fantasy_totals')
      .select('competitor_id, round_points, cut_bonus, finish_bonus, total_fantasy_points')
      .eq('event_id', eventId),
  ])

  if (draftBoardError) {
    throw new Error(`Unable to load draft board: ${draftBoardError.message}`)
  }

  if (orderError) {
    throw new Error(`Unable to load draft order: ${orderError.message}`)
  }

  if (liveRowsError) {
    throw new Error(`Unable to load live rows: ${liveRowsError.message}`)
  }

  if (fantasyTotalsError) {
    throw new Error(`Unable to load fantasy totals: ${fantasyTotalsError.message}`)
  }

  const liveMap = new Map<string, LiveStateRow>()
  for (const row of (liveRows ?? []) as LiveStateRow[]) {
    liveMap.set(row.competitor_id, row)
  }

  const fantasyTotalsMap = new Map<string, FantasyTotalsRow>()
  for (const row of (fantasyTotalsRows ?? []) as FantasyTotalsRow[]) {
    fantasyTotalsMap.set(row.competitor_id, row)
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
    const totals = fantasyTotalsMap.get(competitorId)

    const totalToPar = live?.total_to_par ?? null
    const todayToPar = live?.today_to_par ?? null

    const liveBasePoints = livePointsFromTotalToPar(totalToPar)
    const todayPoints = todayPointsFromToPar(todayToPar)

    const cutBonus = totals?.cut_bonus ?? 0
    const finishBonus = totals?.finish_bonus ?? 0

    const totalFantasyPoints = liveBasePoints + cutBonus + finishBonus
    const cutStatus = deriveCutStatus(live?.status)

    playerFantasyPayload.push({
      league_id: leagueId,
      event_id: eventId,
      competitor_id: competitorId,
      manager_user_id: owner?.user_id ?? null,
      manager_display_name: owner?.display_name ?? null,
      player_name: competitorName,
      total_to_par: totalToPar,
      today_to_par: todayToPar,
      thru: normalizeThruValue(live?.thru),
      status: live?.status ?? null,
      fantasy_points_total: totalFantasyPoints,
      today_points: todayPoints,
      made_cut_bonus: cutBonus > 0 ? cutBonus : 0,
      placement_bonus: finishBonus,
      round_1_points: 0,
      round_2_points: 0,
      round_3_points: 0,
      round_4_points: 0,
      cut_status: cutStatus,
      cut_bonus: cutBonus,
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