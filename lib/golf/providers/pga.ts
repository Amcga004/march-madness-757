import type { ProviderFetchResult, ProviderPlayerRow } from './types'

function parseToPar(value: string | number | null | undefined): number | null {
  if (value == null) return null
  if (typeof value === 'number') return value

  const cleaned = value.trim().toUpperCase()
  if (!cleaned || cleaned === 'E') return 0

  const normalized = cleaned.replace('−', '-').replace('+', '')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function flattenObjects(obj: unknown, acc: unknown[] = []): unknown[] {
  if (Array.isArray(obj)) {
    for (const item of obj) flattenObjects(item, acc)
    return acc
  }

  if (obj && typeof obj === 'object') {
    acc.push(obj)
    for (const value of Object.values(obj as Record<string, unknown>)) {
      flattenObjects(value, acc)
    }
  }

  return acc
}

function extractName(record: Record<string, unknown>): string | null {
  const directKeys = [
    'playerName',
    'player_name',
    'displayName',
    'display_name',
    'name',
    'fullName',
    'full_name',
    'shortName',
  ]

  for (const key of directKeys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  const player = record.player
  if (player && typeof player === 'object') {
    const playerRecord = player as Record<string, unknown>
    for (const key of directKeys) {
      const value = playerRecord[key]
      if (typeof value === 'string' && value.trim()) {
        return value.trim()
      }
    }
  }

  return null
}

function extractRowsFromPgaJson(payload: unknown): ProviderPlayerRow[] {
  const allObjects = flattenObjects(payload)
  const rows: ProviderPlayerRow[] = []

  for (const node of allObjects) {
    if (!node || typeof node !== 'object') continue
    const record = node as Record<string, unknown>

    const playerName = extractName(record)
    const positionText =
      typeof record.position === 'string'
        ? record.position
        : typeof record.pos === 'string'
          ? record.pos
          : typeof record.rank === 'string'
            ? record.rank
            : null

    const totalToPar = parseToPar(
      typeof record.totalToPar === 'string' || typeof record.totalToPar === 'number'
        ? (record.totalToPar as string | number)
        : typeof record.total_to_par === 'string' || typeof record.total_to_par === 'number'
          ? (record.total_to_par as string | number)
          : typeof record.toPar === 'string' || typeof record.toPar === 'number'
            ? (record.toPar as string | number)
            : typeof record.score === 'string' || typeof record.score === 'number'
              ? (record.score as string | number)
              : null
    )

    const todayToPar = parseToPar(
      typeof record.today === 'string' || typeof record.today === 'number'
        ? (record.today as string | number)
        : typeof record.todayToPar === 'string' || typeof record.todayToPar === 'number'
          ? (record.todayToPar as string | number)
          : typeof record.today_to_par === 'string' || typeof record.today_to_par === 'number'
            ? (record.today_to_par as string | number)
            : null
    )

    const thru =
      typeof record.thru === 'string'
        ? record.thru
        : typeof record.through === 'string'
          ? record.through
          : typeof record.holesCompletedText === 'string'
            ? record.holesCompletedText
            : typeof record.status === 'string' && /^\d+$|^F$/i.test(record.status)
              ? record.status
              : null

    const holesCompleted =
      typeof record.holesCompleted === 'number'
        ? record.holesCompleted
        : typeof thru === 'string' && /^\d+$/.test(thru)
          ? Number(thru)
          : null

    const currentRound =
      typeof record.currentRound === 'number'
        ? record.currentRound
        : typeof record.round === 'number'
          ? record.round
          : null

    const round1 =
      typeof record.round1 === 'number'
        ? record.round1
        : typeof record.r1 === 'number'
          ? record.r1
          : null

    const round2 =
      typeof record.round2 === 'number'
        ? record.round2
        : typeof record.r2 === 'number'
          ? record.r2
          : null

    const round3 =
      typeof record.round3 === 'number'
        ? record.round3
        : typeof record.r3 === 'number'
          ? record.r3
          : null

    const round4 =
      typeof record.round4 === 'number'
        ? record.round4
        : typeof record.r4 === 'number'
          ? record.r4
          : null

    const status =
      typeof record.status === 'string'
        ? record.status
        : typeof record.playerStatus === 'string'
          ? record.playerStatus
          : null

    if (
      playerName &&
      (positionText || totalToPar !== null || todayToPar !== null || thru || status)
    ) {
      rows.push({
        playerName,
        source: 'pga',
        positionText,
        totalToPar,
        todayToPar,
        thru,
        holesCompleted,
        currentRound,
        round1,
        round2,
        round3,
        round4,
        madeCut: null,
        status,
        sourceUpdatedAt: null,
        rawPayload: record,
      })
    }
  }

  const deduped = new Map<string, ProviderPlayerRow>()
  for (const row of rows) {
    if (!deduped.has(row.playerName)) {
      deduped.set(row.playerName, row)
    }
  }

  return Array.from(deduped.values())
}

export async function fetchPgaLeaderboard(): Promise<ProviderFetchResult> {
  const url = process.env.PGA_GOLF_EVENT_URL

  if (!url) {
    return {
      source: 'pga',
      success: false,
      rows: [],
      message: 'Missing PGA_GOLF_EVENT_URL',
    }
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      return {
        source: 'pga',
        success: false,
        rows: [],
        message: `PGA fetch failed with ${res.status}`,
      }
    }

    const html = await res.text()

    const scriptMatches = Array.from(
      html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)
    ).map((m) => m[1])

    const allRows: ProviderPlayerRow[] = []

    for (const block of scriptMatches) {
      const trimmed = block.trim()
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) continue

      const parsed = safeJsonParse<unknown>(trimmed)
      if (!parsed) continue

      const rows = extractRowsFromPgaJson(parsed)
      if (rows.length > 0) {
        allRows.push(...rows)
      }
    }

    const deduped = new Map<string, ProviderPlayerRow>()
    for (const row of allRows) {
      if (!deduped.has(row.playerName)) deduped.set(row.playerName, row)
    }

    const rows = Array.from(deduped.values())

    return {
      source: 'pga',
      success: rows.length > 0,
      rows,
      message: rows.length > 0 ? undefined : 'No parseable leaderboard rows found on PGA page',
    }
  } catch (error) {
    return {
      source: 'pga',
      success: false,
      rows: [],
      message: error instanceof Error ? error.message : 'Unknown PGA error',
    }
  }
}