import type { ProviderFetchResult, ProviderPlayerRow } from './types'

function parseToPar(value: string | number | null | undefined): number | null {
  if (value == null) return null
  if (typeof value === 'number') return value

  const cleaned = value.trim().toUpperCase()
  if (!cleaned || cleaned === 'E') return 0
  const n = Number(cleaned.replace('+', ''))
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

function extractRowsFromEspnJson(payload: unknown): ProviderPlayerRow[] {
  const allObjects = flattenObjects(payload)
  const rows: ProviderPlayerRow[] = []

  for (const node of allObjects) {
    if (!node || typeof node !== 'object') continue
    const record = node as Record<string, unknown>

    const possibleName =
      typeof record.displayName === 'string'
        ? record.displayName
        : typeof record.shortName === 'string'
        ? record.shortName
        : typeof record.athlete === 'object' &&
            record.athlete &&
            typeof (record.athlete as Record<string, unknown>).displayName === 'string'
          ? ((record.athlete as Record<string, unknown>).displayName as string)
          : null

    const positionText =
      typeof record.position === 'object' &&
      record.position &&
      typeof (record.position as Record<string, unknown>).displayValue === 'string'
        ? ((record.position as Record<string, unknown>).displayValue as string)
        : typeof record.position === 'string'
          ? record.position
          : null

    const totalToPar = parseToPar(
      typeof record.toPar === 'string' || typeof record.toPar === 'number'
        ? (record.toPar as string | number)
        : typeof record.totalToPar === 'string' || typeof record.totalToPar === 'number'
          ? (record.totalToPar as string | number)
          : null
    )

    const todayToPar = parseToPar(
      typeof record.today === 'string' || typeof record.today === 'number'
        ? (record.today as string | number)
        : typeof record.todayToPar === 'string' || typeof record.todayToPar === 'number'
          ? (record.todayToPar as string | number)
          : null
    )

    const thru =
      typeof record.thru === 'string'
        ? record.thru
        : typeof record.through === 'string'
          ? record.through
          : null

    const holesCompleted =
      typeof record.holesCompleted === 'number'
        ? record.holesCompleted
        : typeof thru === 'string' && /^\d+$/.test(thru)
          ? Number(thru)
          : null

    if (possibleName && (positionText || totalToPar !== null || thru || todayToPar !== null)) {
      rows.push({
        playerName: possibleName,
        source: 'espn',
        positionText,
        totalToPar,
        todayToPar,
        thru,
        holesCompleted,
        status: typeof record.status === 'string' ? record.status : null,
        sourceUpdatedAt: null,
        rawPayload: record,
      })
    }
  }

  const deduped = new Map<string, ProviderPlayerRow>()
  for (const row of rows) {
    if (!deduped.has(row.playerName)) deduped.set(row.playerName, row)
  }

  return Array.from(deduped.values())
}

export async function fetchEspnLeaderboard(): Promise<ProviderFetchResult> {
  const url = process.env.ESPN_GOLF_EVENT_URL

  if (!url) {
    return {
      source: 'espn',
      success: false,
      rows: [],
      message: 'Missing ESPN_GOLF_EVENT_URL',
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
        source: 'espn',
        success: false,
        rows: [],
        message: `ESPN fetch failed with ${res.status}`,
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

      const rows = extractRowsFromEspnJson(parsed)
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
      source: 'espn',
      success: rows.length > 0,
      rows,
      message: rows.length > 0 ? undefined : 'No parseable leaderboard rows found on ESPN page',
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