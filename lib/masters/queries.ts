import { createClient } from '@/lib/supabase/server'
import type {
  DraftRoomData,
  LeagueMeta,
  EventMeta,
  CurrentTurn,
  DraftOrderItem,
  DraftPick,
  ManagerRoster,
} from './types'

type GenericRow = Record<string, unknown>

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function buildDraftPickId(
  leagueId: string,
  overallPick: number | null,
  competitorId: string | null
) {
  return `${leagueId}:${overallPick ?? 'na'}:${competitorId ?? 'na'}`
}

export async function getDraftRoomData(leagueId: string): Promise<DraftRoomData> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const currentUserId = user?.id ?? null

  const { data: leagueData } = await supabase
    .from('leagues_v2')
    .select('*')
    .eq('id', leagueId)
    .maybeSingle()

  const league: LeagueMeta | null = leagueData
    ? {
        id: leagueData.id,
        name: leagueData.name,
        status: leagueData.draft_status ?? 'pending',
        roster_size: leagueData.roster_size,
        max_members: leagueData.max_members,
        created_by: leagueData.created_by ?? null,
        event_id: leagueData.event_id ?? null,
      }
    : null

  let event: EventMeta | null = null

  if (league?.event_id) {
    const { data: eventData } = await supabase
      .from('platform_events')
      .select('id, name, starts_at')
      .eq('id', league.event_id)
      .maybeSingle()

    event = eventData
      ? {
          id: eventData.id,
          name: eventData.name,
          season: eventData.starts_at ? new Date(eventData.starts_at).getFullYear() : null,
          sport: null,
        }
      : null
  }

  const { data: currentTurnData } = await supabase
    .from('current_draft_turn_v2')
    .select('*')
    .eq('league_id', leagueId)
    .maybeSingle()

  const currentTurn: CurrentTurn | null = currentTurnData
    ? {
        draft_id: currentTurnData.draft_id,
        league_id: currentTurnData.league_id,
        current_pick: currentTurnData.current_pick,
        current_round: currentTurnData.current_round,
        status: currentTurnData.status,
        current_drafter_user_id:
          currentTurnData.user_id ??
          currentTurnData.current_drafter_user_id ??
          null,
        current_drafter_member_id: currentTurnData.member_id ?? null,
        current_drafter_name:
          currentTurnData.current_drafter ??
          currentTurnData.display_name ??
          null,
        draft_position: currentTurnData.draft_position ?? null,
      }
    : null

  const { data: orderData } = await supabase
    .from('league_draft_order_v2')
    .select('*')
    .eq('league_id', leagueId)
    .order('draft_position', { ascending: true })

  const draftOrder: DraftOrderItem[] =
    orderData?.map((row) => ({
      member_id: row.user_id,
      user_id: row.user_id,
      display_name: row.display_name,
      draft_position: row.draft_position,
    })) ?? []

  const draftPositionNameMap = new Map<number, string>()
  const rosterMap = new Map<string, ManagerRoster>()

  for (const row of draftOrder) {
    draftPositionNameMap.set(row.draft_position, row.display_name)
    rosterMap.set(row.user_id, {
      member_id: row.user_id,
      user_id: row.user_id,
      display_name: row.display_name,
      players: [],
    })
  }

  const { data: draftedBoardData } = await supabase
    .from('drafted_board_v2')
    .select('*')
    .eq('league_id', leagueId)
    .order('overall_pick', { ascending: false })

  const draftedRows = (draftedBoardData ?? []) as GenericRow[]
  const draftedCompetitorIds = draftedRows
    .map((row) => asString(row.competitor_id))
    .filter((value): value is string => !!value)

  let competitorMap = new Map<string, GenericRow>()

  if (league?.event_id) {
    const { data: fieldRows } = await supabase
      .from('event_competitors')
      .select('*')
      .eq('event_id', league.event_id)
      .order('seed_order', { ascending: true })

    const eventFieldRows = (fieldRows ?? []) as GenericRow[]
    const fieldCompetitorIds = eventFieldRows
      .map((row) => asString(row.competitor_id))
      .filter((value): value is string => !!value)

    if (fieldCompetitorIds.length > 0) {
      const { data: competitorRows } = await supabase
        .from('competitors')
        .select('*')
        .in('id', fieldCompetitorIds)

      competitorMap = new Map(
        ((competitorRows ?? []) as GenericRow[]).map((row) => [String(row.id), row])
      )

      const draftedSet = new Set(draftedCompetitorIds)

      const availablePlayers = eventFieldRows
        .filter((row) => {
          const competitorId = asString(row.competitor_id)
          if (!competitorId) return false
          if (draftedSet.has(competitorId)) return false
          if (
            Object.prototype.hasOwnProperty.call(row, 'is_active') &&
            row.is_active === false
          ) {
            return false
          }
          return true
        })
        .map((row) => {
          const competitorId = asString(row.competitor_id)!
          const competitor = competitorMap.get(competitorId)

          return {
            competitor_id: competitorId,
            player_name:
              asString(competitor?.name) ??
              asString(row.player_name) ??
              asString(row.competitor_name) ??
              'Unknown Player',
            world_rank:
              asNumber(competitor?.world_rank) ??
              asNumber(row.world_rank) ??
              null,
            fedex_points:
              asNumber(competitor?.fedex_points) ??
              asNumber(row.fedex_points) ??
              null,
            top_10_finishes:
              asNumber(competitor?.top_10_finishes) ??
              asNumber(row.top_10_finishes) ??
              null,
            country:
              asString(competitor?.country) ??
              asString(row.country) ??
              null,
          }
        })

      const recentPicks: DraftPick[] = draftedRows.slice(0, 10).map((row) => {
        const competitorId = asString(row.competitor_id)
        const overallPick = asNumber(row.overall_pick)
        const roundNumber = asNumber(row.round_number)
        const pickInRound = asNumber(row.pick_in_round)
        const draftPosition = asNumber(row.draft_position)
        const competitor = competitorId ? competitorMap.get(competitorId) : null

        return {
          id: buildDraftPickId(leagueId, overallPick, competitorId),
          overall_pick: overallPick ?? 0,
          round_number: roundNumber ?? 0,
          round_pick: pickInRound ?? 0,
          manager_name:
            asString(row.display_name) ??
            (draftPosition != null ? draftPositionNameMap.get(draftPosition) ?? null : null) ??
            'Manager',
          competitor_name:
            asString(row.competitor_name) ??
            asString(competitor?.name) ??
            'Player',
          competitor_id: competitorId ?? '',
        }
      })

      for (const row of draftedRows) {
        const competitorId = asString(row.competitor_id)
        const draftPosition = asNumber(row.draft_position)

        if (!competitorId || draftPosition == null) continue

        const owner = draftOrder.find((item) => item.draft_position === draftPosition)
        if (!owner) continue

        const competitor = competitorMap.get(competitorId)
        const playerName =
          asString(row.competitor_name) ??
          asString(competitor?.name) ??
          'Player'

        rosterMap.get(owner.user_id)?.players.push({
          competitor_id: competitorId,
          player_name: playerName,
        })
      }

      const rosters = Array.from(rosterMap.values()).sort((a, b) =>
        a.display_name.localeCompare(b.display_name)
      )

      const isCommissioner =
        !!currentUserId && !!league?.created_by && currentUserId === league.created_by

      const upcomingPicks = buildUpcomingPicks({
        currentTurn,
        draftOrder,
        rosterSize: league?.roster_size ?? 12,
        count: 6,
      })

      return {
        league,
        event,
        currentTurn,
        draftOrder,
        availablePlayers,
        recentPicks,
        upcomingPicks,
        rosters,
        isCommissioner,
        currentUserId,
      }
    }
  }

  const isCommissioner =
    !!currentUserId && !!league?.created_by && currentUserId === league.created_by

  const upcomingPicks = buildUpcomingPicks({
    currentTurn,
    draftOrder,
    rosterSize: league?.roster_size ?? 12,
    count: 6,
  })

  return {
    league,
    event,
    currentTurn,
    draftOrder,
    availablePlayers: [],
    recentPicks: draftedRows.slice(0, 10).map((row) => {
      const competitorId = asString(row.competitor_id)
      const overallPick = asNumber(row.overall_pick)
      const roundNumber = asNumber(row.round_number)
      const pickInRound = asNumber(row.pick_in_round)
      const draftPosition = asNumber(row.draft_position)

      return {
        id: buildDraftPickId(leagueId, overallPick, competitorId),
        overall_pick: overallPick ?? 0,
        round_number: roundNumber ?? 0,
        round_pick: pickInRound ?? 0,
        manager_name:
          asString(row.display_name) ??
          (draftPosition != null ? draftPositionNameMap.get(draftPosition) ?? null : null) ??
          'Manager',
        competitor_name: asString(row.competitor_name) ?? 'Player',
        competitor_id: competitorId ?? '',
      }
    }),
    upcomingPicks,
    rosters: Array.from(rosterMap.values()).sort((a, b) =>
      a.display_name.localeCompare(b.display_name)
    ),
    isCommissioner,
    currentUserId,
  }
}

function buildUpcomingPicks({
  currentTurn,
  draftOrder,
  rosterSize,
  count,
}: {
  currentTurn: CurrentTurn | null
  draftOrder: DraftOrderItem[]
  rosterSize: number
  count: number
}) {
  if (!currentTurn || draftOrder.length === 0) return []

  const queue: {
    overall_pick: number
    round_number: number
    round_pick: number
    manager_name: string
  }[] = []

  const totalManagers = draftOrder.length
  let overall = currentTurn.current_pick
  let round = currentTurn.current_round

  while (queue.length < count && round <= rosterSize) {
    const roundOrder =
      round % 2 === 1 ? draftOrder : [...draftOrder].reverse()

    const startRoundPick =
      round === currentTurn.current_round
        ? currentTurn.current_pick - (round - 1) * totalManagers
        : 1

    for (let rp = startRoundPick; rp <= roundOrder.length; rp++) {
      const drafter = roundOrder[rp - 1]
      queue.push({
        overall_pick: overall,
        round_number: round,
        round_pick: rp,
        manager_name: drafter.display_name,
      })
      overall += 1

      if (queue.length >= count) break
    }

    round += 1
  }

  return queue
}

export async function getFullDraftBoard(leagueId: string): Promise<DraftPick[]> {
  const supabase = await createClient()

  const [{ data: draftRows }, { data: orderRows }] = await Promise.all([
    supabase
      .from('drafted_board_v2')
      .select('*')
      .eq('league_id', leagueId)
      .order('overall_pick', { ascending: true }),
    supabase
      .from('league_draft_order_v2')
      .select('user_id, display_name, draft_position')
      .eq('league_id', leagueId)
      .order('draft_position', { ascending: true }),
  ])

  const draftPositionNameMap = new Map<number, string>(
    (orderRows ?? []).map((row) => [row.draft_position, row.display_name])
  )

  return ((draftRows ?? []) as GenericRow[]).map((row) => {
    const competitorId = asString(row.competitor_id)
    const overallPick = asNumber(row.overall_pick)
    const roundNumber = asNumber(row.round_number)
    const pickInRound = asNumber(row.pick_in_round)
    const draftPosition = asNumber(row.draft_position)

    return {
      id: buildDraftPickId(leagueId, overallPick, competitorId),
      overall_pick: overallPick ?? 0,
      round_number: roundNumber ?? 0,
      round_pick: pickInRound ?? 0,
      manager_name:
        asString(row.display_name) ??
        (draftPosition != null ? draftPositionNameMap.get(draftPosition) ?? null : null) ??
        'Manager',
      competitor_name: asString(row.competitor_name) ?? 'Player',
      competitor_id: competitorId ?? '',
    }
  })
}