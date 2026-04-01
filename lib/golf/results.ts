import { createClient } from '@/lib/supabase/server'
import type { ProviderPlayerRow } from './providers/types'

type EventRow = {
  id: string
  course_par: number | null
  status: string | null
}

function parsePosition(positionText: string | null | undefined): number | null {
  if (!positionText) return null
  const normalized = positionText.trim().toUpperCase().replace(/^T/, '')
  const parsed = Number.parseInt(normalized, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeThru(value: string | null | undefined): string | null {
  if (!value) return null
  return value.trim().toUpperCase()
}

function deriveEventStatus(row: ProviderPlayerRow): string {
  const thru = normalizeThru(row.thru)
  const rawStatus = row.status?.trim()

  if (rawStatus) return rawStatus
  if (thru === 'F') return 'Final'
  if (thru) return 'In Progress'
  return 'Not Started'
}

function deriveRoundFinality(
  roundNumber: number,
  currentRound: number | null | undefined,
  thru: string | null | undefined
) {
  const normalizedThru = normalizeThru(thru)

  if (!currentRound) return false
  if (currentRound > roundNumber) return true
  if (currentRound === roundNumber && normalizedThru === 'F') return true
  return false
}

function scoreToParFromRoundStrokes(roundStrokes: number, coursePar: number) {
  return roundStrokes - coursePar
}

export async function upsertRoundAndEventResults(params: {
  eventId: string
  rows: ProviderPlayerRow[]
}) {
  const { eventId, rows } = params
  const supabase = await createClient()

  const { data: eventRow, error: eventError } = await supabase
    .from('events')
    .select('id, course_par, status')
    .eq('id', eventId)
    .maybeSingle()

  if (eventError) {
    throw new Error(`Unable to load event par: ${eventError.message}`)
  }

  const typedEvent = eventRow as EventRow | null
  const coursePar = typedEvent?.course_par ?? 72

  const { data: eventCompetitors, error: eventCompetitorsError } = await supabase
    .from('event_competitors')
    .select('competitor_id')
    .eq('event_id', eventId)
    .eq('is_active', true)

  if (eventCompetitorsError) {
    throw new Error(`Unable to load event competitors: ${eventCompetitorsError.message}`)
  }

  const competitorIds = (eventCompetitors ?? []).map((row) => row.competitor_id)

  const { data: competitors, error: competitorsError } = await supabase
    .from('competitors')
    .select('id, name, short_name')
    .in('id', competitorIds)

  if (competitorsError) {
    throw new Error(`Unable to load competitors: ${competitorsError.message}`)
  }

  const competitorNameMap = new Map<string, string>()
  for (const row of competitors ?? []) {
    const name = row.name || row.short_name || ''
    if (name) {
      competitorNameMap.set(
        name
          .toLowerCase()
          .replace(/\./g, '')
          .replace(/,/g, '')
          .replace(/\s+/g, ' ')
          .trim(),
        row.id
      )
    }
  }

  const roundPayload: Array<{
    event_id: string
    competitor_id: string
    round_number: number
    round_strokes: number
    score_to_par: number
    status: string
    source_updated_at: string | null
    is_final: boolean
    updated_at: string
  }> = []

  const eventPayload: Array<{
    event_id: string
    competitor_id: string
    position: number | null
    score_to_par: number | null
    total_strokes: number | null
    thru: number | null
    made_cut: boolean | null
    status: string
    source_updated_at: string | null
    updated_at: string
  }> = []

  for (const row of rows) {
    const normalizedName = row.playerName
      .toLowerCase()
      .replace(/\./g, '')
      .replace(/,/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    const competitorId = competitorNameMap.get(normalizedName)
    if (!competitorId) continue

    const rounds = [
      { roundNumber: 1, strokes: row.round1 },
      { roundNumber: 2, strokes: row.round2 },
      { roundNumber: 3, strokes: row.round3 },
      { roundNumber: 4, strokes: row.round4 },
    ]

    for (const round of rounds) {
      if (round.strokes == null) continue

      roundPayload.push({
        event_id: eventId,
        competitor_id: competitorId,
        round_number: round.roundNumber,
        round_strokes: round.strokes,
        score_to_par: scoreToParFromRoundStrokes(round.strokes, coursePar),
        status: deriveEventStatus(row),
        source_updated_at: row.sourceUpdatedAt ?? null,
        is_final: deriveRoundFinality(round.roundNumber, row.currentRound, row.thru),
        updated_at: new Date().toISOString(),
      })
    }

    eventPayload.push({
      event_id: eventId,
      competitor_id: competitorId,
      position: parsePosition(row.positionText),
      score_to_par: row.totalToPar ?? null,
      total_strokes:
        [row.round1, row.round2, row.round3, row.round4]
          .filter((value): value is number => value != null)
          .reduce((sum, value) => sum + value, 0) || null,
      thru:
        row.thru && /^\d+$/.test(row.thru.trim()) ? Number.parseInt(row.thru.trim(), 10) : null,
      made_cut: row.madeCut ?? null,
      status: deriveEventStatus(row),
      source_updated_at: row.sourceUpdatedAt ?? null,
      updated_at: new Date().toISOString(),
    })
  }

  if (roundPayload.length > 0) {
    const { error: roundUpsertError } = await supabase
      .from('golf_round_results')
      .upsert(roundPayload, {
        onConflict: 'event_id,competitor_id,round_number',
      })

    if (roundUpsertError) {
      throw new Error(`Unable to upsert golf_round_results: ${roundUpsertError.message}`)
    }
  }

  if (eventPayload.length > 0) {
    const { error: eventUpsertError } = await supabase
      .from('golf_event_results')
      .upsert(eventPayload, {
        onConflict: 'event_id,competitor_id',
      })

    if (eventUpsertError) {
      throw new Error(`Unable to upsert golf_event_results: ${eventUpsertError.message}`)
    }
  }

  return {
    roundRowCount: roundPayload.length,
    eventRowCount: eventPayload.length,
  }
}