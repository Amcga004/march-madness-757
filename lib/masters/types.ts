export type LeagueMeta = {
  id: string
  name: string
  status: string
  roster_size: number
  max_members: number
  created_by?: string | null
  event_id?: string | null
}

export type EventMeta = {
  id: string
  name: string
  sport?: string | null
  season?: number | null
}

export type CurrentTurn = {
  draft_id: string
  league_id: string
  current_pick: number
  current_round: number
  status: string
  current_drafter_user_id?: string | null
  current_drafter_member_id?: string | null
  current_drafter_name?: string | null
  draft_position?: number | null
}

export type DraftOrderItem = {
  member_id: string
  user_id: string
  display_name: string
  draft_position: number
}

export type AvailablePlayer = {
  competitor_id: string
  player_name: string
  world_rank?: number | null
  country?: string | null
  seeded_order?: number | null
}

export type DraftPick = {
  id?: string
  overall_pick: number
  round_number: number
  round_pick: number
  manager_name: string
  competitor_name: string
  competitor_id?: string
}

export type ManagerRoster = {
  member_id: string
  user_id: string
  display_name: string
  players: {
    competitor_id: string
    player_name: string
  }[]
}

export type DraftRoomData = {
  league: LeagueMeta | null
  event: EventMeta | null
  currentTurn: CurrentTurn | null
  draftOrder: DraftOrderItem[]
  availablePlayers: AvailablePlayer[]
  recentPicks: DraftPick[]
  upcomingPicks: {
    overall_pick: number
    round_number: number
    round_pick: number
    manager_name: string
  }[]
  rosters: ManagerRoster[]
  isCommissioner: boolean
  currentUserId: string | null
}