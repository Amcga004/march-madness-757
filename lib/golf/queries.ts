import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export type LeaderboardRow = {
  competitor_id: string
  player_name: string
  manager_display_name: string | null
  position_text: string | null
  today_to_par: number | null
  total_to_par: number | null
  fantasy_points_total: number
  today_points: number
  thru: string | null
  status: string | null
}

type CompetitorRow = {
  id: string
  name: string
}

type LiveStateRow = {
  competitor_id: string
  player_name?: string | null
  position_text?: string | null
  today_to_par?: number | null
  total_to_par?: number | null
  thru?: string | null
  status?: string | null
}

export type FantasyRow = {
  competitor_id: string
  player_name?: string | null
  manager_display_name?: string | null
  fantasy_points_total?: number | null
  today_points?: number | null
  today_to_par?: number | null
  total_to_par?: number | null
}

export type FantasyStandingRow = {
  display_name: string
  fantasy_points: number
  active_golfers?: number | null
  finished_golfers?: number | null
}

export type LeaguePulse = {
  activeGolfers: number
  finishedGolfers: number
  draftedGolfers: number
  leaderName: string | null
  leaderPoints: number
}

export type EventHubData = {
  league: {
    id: string
    name: string
    event_id: string | null
    roster_size: number | null
    max_members: number | null
    draft_status: string | null
    created_by: string | null
  } | null
  platformEvent: {
    id: string
    name: string
    starts_at: string | null
  } | null
  memberCount: number
  livePlayers: LeaderboardRow[]
  fantasyStandings: FantasyStandingRow[]
  topContributors: {
    player_name: string
    manager_display_name: string | null
    fantasy_points_total: number
    today_to_par: number | null
    total_to_par: number | null
  }[]
  leaguePulse: LeaguePulse
}

export type LeaderboardPageData = {
  league: {
    id: string
    name: string
    event_id: string | null
    roster_size: number | null
    draft_status: string | null
  } | null
  rows: LeaderboardRow[]
}

function isFinished(status: string | null | undefined, thru: string | null | undefined) {
  const normalizedStatus = status?.toLowerCase() ?? ''
  const normalizedThru = thru?.toLowerCase() ?? ''

  return (
    normalizedStatus.includes('final') ||
    normalizedStatus.includes('finished') ||
    normalizedThru === 'f'
  )
}

function isInProgress(status: string | null | undefined) {
  const normalizedStatus = status?.toLowerCase() ?? ''
  return normalizedStatus.includes('in progress')
}

function sortLeaderboardRows(rows: LeaderboardRow[]) {
  return [...rows].sort((a, b) => {
    const aHasScore = a.total_to_par != null
    const bHasScore = b.total_to_par != null

    if (aHasScore && !bHasScore) return -1
    if (!aHasScore && bHasScore) return 1

    if (a.total_to_par != null && b.total_to_par != null && a.total_to_par !== b.total_to_par) {
      return a.total_to_par - b.total_to_par
    }

    return a.player_name.localeCompare(b.player_name)
  })
}

function sortHubLiveRows(rows: LeaderboardRow[]) {
  return [...rows].sort((a, b) => {
    const aProgressBucket = isInProgress(a.status) ? 0 : isFinished(a.status, a.thru) ? 1 : 2
    const bProgressBucket = isInProgress(b.status) ? 0 : isFinished(b.status, b.thru) ? 1 : 2

    if (aProgressBucket !== bProgressBucket) {
      return aProgressBucket - bProgressBucket
    }

    const aHasToday = a.today_to_par != null
    const bHasToday = b.today_to_par != null

    if (aHasToday && !bHasToday) return -1
    if (!aHasToday && bHasToday) return 1

    if (a.today_to_par != null && b.today_to_par != null && a.today_to_par !== b.today_to_par) {
      return a.today_to_par - b.today_to_par
    }

    const aHasTotal = a.total_to_par != null
    const bHasTotal = b.total_to_par != null

    if (aHasTotal && !bHasTotal) return -1
    if (!aHasTotal && bHasTotal) return 1

    if (a.total_to_par != null && b.total_to_par != null && a.total_to_par !== b.total_to_par) {
      return a.total_to_par - b.total_to_par
    }

    return a.player_name.localeCompare(b.player_name)
  })
}

function buildFullFieldRows(
  competitors: CompetitorRow[],
  liveRows: LiveStateRow[],
  fantasyRows: FantasyRow[]
): LeaderboardRow[] {
  const liveMap = new Map<string, LiveStateRow>()
  for (const row of liveRows) {
    liveMap.set(row.competitor_id, row)
  }

  const fantasyMap = new Map<string, FantasyRow>()
  for (const row of fantasyRows) {
    fantasyMap.set(row.competitor_id, row)
  }

  return competitors.map((competitor) => {
    const live = liveMap.get(competitor.id)
    const fantasy = fantasyMap.get(competitor.id)

    return {
      competitor_id: competitor.id,
      player_name: fantasy?.player_name ?? live?.player_name ?? competitor.name ?? 'Player',
      manager_display_name: fantasy?.manager_display_name ?? null,
      position_text: live?.position_text ?? null,
      today_to_par: live?.today_to_par ?? null,
      total_to_par: live?.total_to_par ?? null,
      fantasy_points_total: fantasy?.fantasy_points_total ?? 0,
      today_points: fantasy?.today_points ?? 0,
      thru: live?.thru ?? null,
      status: live?.status ?? 'Not Started',
    }
  })
}

export async function getEventHubData(leagueId: string): Promise<EventHubData> {
  const supabase = createServiceClient()

  const { data: league } = await supabase
    .from('leagues_v2')
    .select('id, name, event_id, roster_size, max_members, draft_status, created_by')
    .eq('id', leagueId)
    .maybeSingle()

  if (!league?.event_id) {
    const { count: memberCount } = await supabase
      .from('league_draft_order_v2')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', leagueId)
    return {
      league: league ?? null,
      platformEvent: null,
      memberCount: memberCount ?? 0,
      livePlayers: [],
      fantasyStandings: [],
      topContributors: [],
      leaguePulse: {
        activeGolfers: 0,
        finishedGolfers: 0,
        draftedGolfers: 0,
        leaderName: null,
        leaderPoints: 0,
      },
    }
  }

  const [
    { data: platformEvent },
    { count: memberCount },
    { data: competitors },
    { data: liveRows },
    { data: fantasyStandings },
    { data: playerFantasyRows },
  ] = await Promise.all([
    supabase
      .from('platform_events')
      .select('id, name, starts_at')
      .eq('id', league.event_id)
      .maybeSingle(),
    supabase
      .from('league_draft_order_v2')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', leagueId),
    supabase.from('competitors').select('id, name').order('name', { ascending: true }),
    supabase
      .from('golf_live_player_state')
      .select('competitor_id, player_name, position_text, today_to_par, total_to_par, thru, status')
      .eq('event_id', league.event_id),
    supabase
      .from('golf_live_manager_scores')
      .select('*')
      .eq('league_id', leagueId)
      .order('fantasy_points', { ascending: false }),
    supabase
      .from('golf_live_player_fantasy_scores')
      .select('*')
      .eq('league_id', leagueId)
      .order('fantasy_points_total', { ascending: false }),
  ])

  const fullFieldRows = buildFullFieldRows(
    (competitors ?? []) as CompetitorRow[],
    (liveRows ?? []) as LiveStateRow[],
    (playerFantasyRows ?? []) as FantasyRow[]
  )

  const standings = (fantasyStandings ?? []) as FantasyStandingRow[]

  const leaguePulse: LeaguePulse = {
    activeGolfers: fullFieldRows.filter((row) => isInProgress(row.status)).length,
    finishedGolfers: fullFieldRows.filter((row) => isFinished(row.status, row.thru)).length,
    draftedGolfers: fullFieldRows.filter((row) => !!row.manager_display_name).length,
    leaderName: standings[0]?.display_name ?? null,
    leaderPoints: standings[0]?.fantasy_points ?? 0,
  }

  const topContributors = ((playerFantasyRows ?? []) as FantasyRow[])
    .slice(0, 6)
    .map((row) => ({
      player_name: row.player_name ?? 'Player',
      manager_display_name: row.manager_display_name ?? null,
      fantasy_points_total: row.fantasy_points_total ?? 0,
      today_to_par: row.today_to_par ?? null,
      total_to_par: row.total_to_par ?? null,
    }))

  const livePlayers = sortHubLiveRows(fullFieldRows).slice(0, 12)

  return {
    league,
    platformEvent: platformEvent ?? null,
    memberCount: memberCount ?? 0,
    livePlayers,
    fantasyStandings: standings,
    topContributors,
    leaguePulse,
  }
}

export async function getLeaderboardPageData(leagueId: string): Promise<LeaderboardPageData> {
  const supabase = await createClient()

  const { data: league } = await supabase
    .from('leagues_v2')
    .select('id, name, event_id, roster_size, draft_status')
    .eq('id', leagueId)
    .maybeSingle()

  if (!league?.event_id) {
    return {
      league: league ?? null,
      rows: [],
    }
  }

  const [{ data: competitors }, { data: liveRows }, { data: fantasyRows }] = await Promise.all([
    supabase.from('competitors').select('id, name').order('name', { ascending: true }),
    supabase
      .from('golf_live_player_state')
      .select('competitor_id, player_name, position_text, today_to_par, total_to_par, thru, status')
      .eq('event_id', league.event_id),
    supabase.from('golf_live_player_fantasy_scores').select('*').eq('league_id', leagueId),
  ])

  const rows = sortLeaderboardRows(
    buildFullFieldRows(
      (competitors ?? []) as CompetitorRow[],
      (liveRows ?? []) as LiveStateRow[],
      (fantasyRows ?? []) as FantasyRow[]
    )
  )

  return {
    league,
    rows,
  }
}

export async function getRostersPageData(leagueId: string) {
  const supabase = await createClient()

  const { data: league } = await supabase
    .from('leagues_v2')
    .select('id, name, event_id, roster_size, draft_status')
    .eq('id', leagueId)
    .maybeSingle()

  if (!league?.event_id) {
    return {
      league: league ?? null,
      rosters: [],
    }
  }

  const [{ data: orderRows }, { data: draftedRows }, { data: liveRows }] = await Promise.all([
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
    supabase.from('golf_live_player_state').select('*').eq('event_id', league.event_id),
  ])

  const liveMap = new Map<string, Record<string, unknown>>()
  for (const row of liveRows ?? []) {
    liveMap.set(row.competitor_id, row as Record<string, unknown>)
  }

  const rosterMap = new Map<
    string,
    {
      member_id: string
      display_name: string
      draft_position: number
      players: Array<{
        competitor_id: string
        player_name: string
        fantasy_points: number
        total_to_par: number | null
        today_to_par: number | null
        thru: string | null
        status: string | null
        source: string | null
        overall_pick: number | null
      }>
    }
  >()

  for (const row of orderRows ?? []) {
    rosterMap.set(row.user_id, {
      member_id: row.user_id,
      display_name: row.display_name,
      draft_position: row.draft_position,
      players: [],
    })
  }

  for (const raw of draftedRows ?? []) {
    const draftPosition = raw.draft_position as number | null
    const competitorId = raw.competitor_id as string | null
    const competitorName = raw.competitor_name as string | null
    const overallPick = raw.overall_pick as number | null

    if (!draftPosition || !competitorId || !competitorName) continue

    const owner = (orderRows ?? []).find((row) => row.draft_position === draftPosition)
    if (!owner) continue

    const live = liveMap.get(competitorId)
    const totalToPar = (live?.total_to_par as number | null) ?? null
    const fantasyPoints = totalToPar == null ? 0 : -1 * totalToPar

    rosterMap.get(owner.user_id)?.players.push({
      competitor_id: competitorId,
      player_name: competitorName,
      fantasy_points: fantasyPoints,
      total_to_par: totalToPar,
      today_to_par: (live?.today_to_par as number | null) ?? null,
      thru: (live?.thru as string | null) ?? null,
      status: (live?.status as string | null) ?? null,
      source: (live?.source as string | null) ?? null,
      overall_pick: overallPick,
    })
  }

  return {
    league,
    rosters: Array.from(rosterMap.values())
      .sort((a, b) => a.draft_position - b.draft_position)
      .map((roster) => ({
        ...roster,
        players: roster.players.sort(
          (a, b) => (a.overall_pick ?? 999) - (b.overall_pick ?? 999)
        ),
      })),
  }
}