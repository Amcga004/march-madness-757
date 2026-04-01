import { createClient } from '@/lib/supabase/server'
import type { ProviderFetchResult, ProviderPlayerRow } from './providers/types'

type EventCompetitorRow = {
  competitor_id: string
}

type AvailableEventCompetitorRow = {
  event_id: string
  competitor_id: string
  seed_order: number | null
  metadata: Record<string, unknown> | null
}

type CompetitorRow = {
  id: string
  name?: string | null
  short_name?: string | null
}

type CompetitorLookup = {
  competitor_id: string
  player_name: string
  event_id: string
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function chooseRow(primary?: ProviderPlayerRow, fallback?: ProviderPlayerRow) {
  const base = primary ?? fallback
  if (!base) return null

  return {
    playerName: primary?.playerName ?? fallback?.playerName ?? '',
    positionText: primary?.positionText ?? fallback?.positionText ?? null,
    totalToPar: primary?.totalToPar ?? fallback?.totalToPar ?? null,
    todayToPar: primary?.todayToPar ?? fallback?.todayToPar ?? null,
    thru: primary?.thru ?? fallback?.thru ?? null,
    holesCompleted: primary?.holesCompleted ?? fallback?.holesCompleted ?? null,
    currentRound: primary?.currentRound ?? fallback?.currentRound ?? null,
    round1: primary?.round1 ?? fallback?.round1 ?? null,
    round2: primary?.round2 ?? fallback?.round2 ?? null,
    round3: primary?.round3 ?? fallback?.round3 ?? null,
    round4: primary?.round4 ?? fallback?.round4 ?? null,
    madeCut: primary?.madeCut ?? fallback?.madeCut ?? null,
    status: primary?.status ?? fallback?.status ?? null,
    source: primary?.source ?? fallback?.source ?? 'mock',
    sourceUpdatedAt: primary?.sourceUpdatedAt ?? fallback?.sourceUpdatedAt ?? null,
    rawPayload: primary?.rawPayload ?? fallback?.rawPayload ?? null,
  }
}

export async function syncEventField(eventId: string) {
  const supabase = await createClient()

  const { data: availableRows, error: availableError } = await supabase
    .from('available_event_competitors_v2')
    .select('event_id, competitor_id, seed_order, metadata')
    .eq('event_id', eventId)
    .order('seed_order', { ascending: true })

  if (availableError) {
    throw new Error(`Unable to load available event competitors: ${availableError.message}`)
  }

  const typedAvailableRows = (availableRows ?? []) as AvailableEventCompetitorRow[]

  if (typedAvailableRows.length === 0) {
    return { rowCount: 0 }
  }

  const { error: deactivateError } = await supabase
    .from('event_competitors')
    .update({ is_active: false })
    .eq('event_id', eventId)

  if (deactivateError) {
    throw new Error(`Unable to deactivate existing event competitors: ${deactivateError.message}`)
  }

  const payload = typedAvailableRows.map((row) => ({
    event_id: row.event_id,
    competitor_id: row.competitor_id,
    is_active: true,
    seed_order: row.seed_order,
    metadata: row.metadata ?? {},
  }))

  const { error: upsertError } = await supabase
    .from('event_competitors')
    .upsert(payload, {
      onConflict: 'event_id,competitor_id',
    })

  if (upsertError) {
    throw new Error(`Unable to upsert event competitors: ${upsertError.message}`)
  }

  return { rowCount: payload.length }
}

export async function upsertNormalizedLiveState(params: {
  eventId: string
  primary: ProviderFetchResult
  fallback: ProviderFetchResult
}) {
  const { eventId, primary, fallback } = params
  const supabase = await createClient()

  const { data: eventCompetitors, error: eventCompetitorsError } = await supabase
    .from('event_competitors')
    .select('competitor_id')
    .eq('event_id', eventId)
    .eq('is_active', true)

  if (eventCompetitorsError) {
    throw new Error(`Unable to load event competitors: ${eventCompetitorsError.message}`)
  }

  const competitorIds = ((eventCompetitors ?? []) as EventCompetitorRow[])
    .map((row) => row.competitor_id)
    .filter(Boolean)

  if (competitorIds.length === 0) {
    return { rowCount: 0 }
  }

  const { data: competitors, error: competitorsError } = await supabase
    .from('competitors')
    .select('id, name, short_name')
    .in('id', competitorIds)

  if (competitorsError) {
    throw new Error(`Unable to load competitors: ${competitorsError.message}`)
  }

  const lookup = new Map<string, CompetitorLookup>()
  for (const row of (competitors ?? []) as CompetitorRow[]) {
    const playerName = row.name || row.short_name || 'Unknown Player'
    lookup.set(normalizeName(playerName), {
      competitor_id: row.id,
      player_name: playerName,
      event_id: eventId,
    })
  }

  const primaryMap = new Map(
    primary.rows.map((r) => [normalizeName(r.playerName), r] as const)
  )
  const fallbackMap = new Map(
    fallback.rows.map((r) => [normalizeName(r.playerName), r] as const)
  )

  const payload: Array<Record<string, unknown>> = []

  for (const [nameKey, competitor] of lookup.entries()) {
    const merged = chooseRow(primaryMap.get(nameKey), fallbackMap.get(nameKey))
    if (!merged) {
      payload.push({
        event_id: eventId,
        competitor_id: competitor.competitor_id,
        player_name: competitor.player_name,
        position_text: null,
        total_to_par: null,
        today_to_par: null,
        thru: null,
        holes_completed: null,
        current_round: null,
        round_1: null,
        round_2: null,
        round_3: null,
        round_4: null,
        made_cut: null,
        status: 'Not Started',
        source: primary.source ?? fallback.source ?? 'espn',
        source_updated_at: null,
        last_synced_at: new Date().toISOString(),
        raw_payload: {},
      })
      continue
    }

    payload.push({
      event_id: eventId,
      competitor_id: competitor.competitor_id,
      player_name: competitor.player_name,
      position_text: merged.positionText,
      total_to_par: merged.totalToPar,
      today_to_par: merged.todayToPar,
      thru: merged.thru,
      holes_completed: merged.holesCompleted,
      current_round: merged.currentRound,
      round_1: merged.round1,
      round_2: merged.round2,
      round_3: merged.round3,
      round_4: merged.round4,
      made_cut: merged.madeCut,
      status: merged.status ?? 'Not Started',
      source: merged.source,
      source_updated_at: merged.sourceUpdatedAt,
      last_synced_at: new Date().toISOString(),
      raw_payload: merged.rawPayload ?? {},
    })
  }

  if (payload.length === 0) {
    return { rowCount: 0 }
  }

  const { error: upsertError } = await supabase
    .from('golf_live_player_state')
    .upsert(payload, {
      onConflict: 'event_id,competitor_id',
    })

  if (upsertError) {
    throw new Error(`Unable to upsert live player state: ${upsertError.message}`)
  }

  return { rowCount: payload.length }
}