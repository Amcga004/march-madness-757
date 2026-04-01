import type { ProviderFetchResult, ProviderPlayerRow } from './types'

function parseToPar(value: string | number | null | undefined): number | null {
  if (value == null) return null
  if (typeof value === 'number') return value

  const cleaned = value.trim().toUpperCase()
  if (!cleaned || cleaned === 'E') return 0

  const n = Number(cleaned.replace('+', ''))
  return Number.isFinite(n) ? n : null
}

function parseIntSafe(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const n = Number.parseInt(value, 10)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function dedupe(rows: ProviderPlayerRow[]): ProviderPlayerRow[] {
  const map = new Map<string, ProviderPlayerRow>()

  for (const row of rows) {
    const key = normalizeName(row.playerName)
    const existing = map.get(key)

    if (!existing) {
      map.set(key, row)
      continue
    }

    const existingScore =
      [existing.round1, existing.round2, existing.round3, existing.round4].filter(v => v != null).length

    const newScore =
      [row.round1, row.round2, row.round3, row.round4].filter(v => v != null).length

    if (newScore > existingScore) {
      map.set(key, row)
    }
  }

  return Array.from(map.values())
}

function extractRounds(linescores: any[]): {
  r1: number | null
  r2: number | null
  r3: number | null
  r4: number | null
} {
  let r1 = null
  let r2 = null
  let r3 = null
  let r4 = null

  for (const l of linescores || []) {
    const round = l.period ?? l.round ?? null
    const score = parseIntSafe(l.value ?? l.score)

    if (round === 1) r1 = score
    if (round === 2) r2 = score
    if (round === 3) r3 = score
    if (round === 4) r4 = score
  }

  return { r1, r2, r3, r4 }
}

export async function fetchEspnLeaderboard(): Promise<ProviderFetchResult> {
  const eventId = process.env.ESPN_GOLF_EVENT_ID

  if (!eventId) {
    return {
      source: 'espn',
      success: false,
      rows: [],
      message: 'Missing ESPN_GOLF_EVENT_ID',
    }
  }

  try {
    const url = `https://site.api.espn.com/apis/v2/sports/golf/pga/leaderboard?event=${eventId}`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      return {
        source: 'espn',
        success: false,
        rows: [],
        message: `ESPN API failed: ${res.status}`,
      }
    }

    const json = await res.json()

    const competitors =
      json?.events?.[0]?.competitions?.[0]?.competitors ??
      json?.competitions?.[0]?.competitors ??
      []

    if (!Array.isArray(competitors)) {
      return {
        source: 'espn',
        success: false,
        rows: [],
        message: 'No competitors found in ESPN response',
      }
    }

    const rows: ProviderPlayerRow[] = []

    for (const c of competitors) {
      const athlete = c.athlete ?? {}
      const name = athlete.displayName ?? athlete.shortName

      if (!name) continue

      const positionText =
        c?.position?.displayValue ??
        c?.position?.abbreviation ??
        null

      const totalToPar = parseToPar(
        c?.score ??
        c?.toPar ??
        c?.totalToPar
      )

      const todayToPar = parseToPar(c?.today)

      const thru = c?.thru ?? null

      const holesCompleted =
        typeof thru === 'string' && /^\d+$/.test(thru)
          ? Number(thru)
          : null

      const { r1, r2, r3, r4 } = extractRounds(c.linescores || [])

      const completedRounds = [r1, r2, r3, r4].filter(v => v != null).length

      const currentRound =
        thru === 'F'
          ? Math.min(completedRounds, 4)
          : Math.min(completedRounds + 1, 4)

      const status =
        thru === 'F'
          ? completedRounds >= 4 ? 'Final' : 'Round Complete'
          : thru ? 'In Progress' : 'Not Started'

      const madeCut =
        completedRounds >= 3
          ? true
          : positionText === 'CUT' || positionText === 'MC'
            ? false
            : null

      rows.push({
        playerName: name,
        source: 'espn',
        positionText,
        totalToPar,
        todayToPar,
        thru,
        holesCompleted,
        currentRound,
        round1: r1,
        round2: r2,
        round3: r3,
        round4: r4,
        madeCut,
        status,
        sourceUpdatedAt: null,
        rawPayload: c,
      })
    }

    const finalRows = dedupe(rows)

    console.log('ESPN API ROWS:', finalRows.length)

    return {
      source: 'espn',
      success: finalRows.length > 0,
      rows: finalRows,
      message: `Parsed ${finalRows.length} players from ESPN API`,
    }
  } catch (error) {
    return {
      source: 'espn',
      success: false,
      rows: [],
      message: error instanceof Error ? error.message : 'Unknown ESPN error',
    }
  }
}