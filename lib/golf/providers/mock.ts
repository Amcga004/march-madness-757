import { createClient } from '@/lib/supabase/server'
import type { ProviderFetchResult, ProviderPlayerRow } from './types'

type EventCompetitorRow = {
  competitor_id: string
  seed_order?: number | null
}

type CompetitorRow = {
  id: string
  name?: string | null
  short_name?: string | null
}

function deterministicNumberFromString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 100000
  }
  return hash
}

function buildMockRow(name: string, seed: number | null | undefined): ProviderPlayerRow {
  const basis = deterministicNumberFromString(name + String(seed ?? 0))

  const totalToParOptions = [-8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3]
  const todayToParOptions = [-4, -3, -2, -1, 0, 1, 2]

  const totalToPar = totalToParOptions[basis % totalToParOptions.length]
  const todayToPar = todayToParOptions[basis % todayToParOptions.length]
  const holesCompleted = (basis % 18) + 1
  const thru = holesCompleted === 18 ? 'F' : String(holesCompleted)

  const positionBase = Math.max(1, (seed ?? 50) - (basis % 6))
  const positionText = `T${positionBase}`

  const round1 = 70 + (basis % 4)
  const round2 = 68 + (basis % 5)
  const round3 = 67 + (basis % 6)
  const round4 = holesCompleted === 18 ? 69 + (basis % 5) : null

  return {
    playerName: name,
    source: 'mock',
    positionText,
    totalToPar,
    todayToPar,
    thru,
    holesCompleted,
    currentRound: 4,
    round1,
    round2,
    round3,
    round4,
    madeCut: true,
    status: holesCompleted === 18 ? 'Final' : 'In Progress',
    sourceUpdatedAt: new Date().toISOString(),
    rawPayload: {
      mock: true,
      seed,
      basis,
    },
  }
}

export async function fetchMockLeaderboard(eventId: string): Promise<ProviderFetchResult> {
  const supabase = await createClient()

  const { data: eventCompetitors, error: eventCompetitorsError } = await supabase
    .from('event_competitors')
    .select('competitor_id, seed_order')
    .eq('event_id', eventId)
    .eq('is_active', true)
    .order('seed_order', { ascending: true })

  if (eventCompetitorsError) {
    return {
      source: 'mock',
      success: false,
      rows: [],
      message: `Mock provider failed to load event competitors: ${eventCompetitorsError.message}`,
    }
  }

  const typedEventCompetitors = (eventCompetitors ?? []) as EventCompetitorRow[]
  const competitorIds = typedEventCompetitors
    .map((row) => row.competitor_id)
    .filter(Boolean)

  if (competitorIds.length === 0) {
    return {
      source: 'mock',
      success: false,
      rows: [],
      message: 'Mock provider found no active event competitors',
    }
  }

  const { data: competitors, error: competitorsError } = await supabase
    .from('competitors')
    .select('id, name, short_name')
    .in('id', competitorIds)

  if (competitorsError) {
    return {
      source: 'mock',
      success: false,
      rows: [],
      message: `Mock provider failed to load competitors: ${competitorsError.message}`,
    }
  }

  const competitorMap = new Map<string, CompetitorRow>()
  for (const raw of (competitors ?? []) as CompetitorRow[]) {
    competitorMap.set(raw.id, raw)
  }

  const rows = typedEventCompetitors
    .map((row, index) => {
      const competitor = competitorMap.get(row.competitor_id)
      if (!competitor) return null

      const name = competitor.name || competitor.short_name || 'Unknown Player'
      return buildMockRow(name, row.seed_order ?? index + 1)
    })
    .filter((row): row is ProviderPlayerRow => row !== null)

  return {
    source: 'mock',
    success: rows.length > 0,
    rows,
    message:
      rows.length > 0
        ? 'Using mock golf leaderboard data from event_competitors + competitors'
        : 'Mock provider could not build any rows',
  }
}