import type { ProviderFetchResult, ProviderPlayerRow } from './types'

function parseToPar(value: string | number | null | undefined): number | null {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  const cleaned = value.trim().toUpperCase()
  if (!cleaned) return null
  if (cleaned === 'E' || cleaned === 'EVEN') return 0
  if (cleaned === 'CUT' || cleaned === 'MC') return null

  const parsed = Number(cleaned.replace('+', ''))
  return Number.isFinite(parsed) ? parsed : null
}

function parseInteger(value: string | number | null | undefined): number | null {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  const cleaned = value.trim()
  if (!cleaned) return null

  const parsed = Number.parseInt(cleaned, 10)
  return Number.isFinite(parsed) ? parsed : null
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

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code)
      return Number.isFinite(n) ? String.fromCharCode(n) : _
    })
}

function stripTags(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

function inferMadeCut(positionText: string | null): boolean | null {
  const normalized = positionText?.trim().toUpperCase() ?? ''
  if (!normalized) return null
  if (normalized === 'CUT' || normalized === 'MC') return false
  return true
}

function dedupeRows(rows: ProviderPlayerRow[]): ProviderPlayerRow[] {
  const deduped = new Map<string, ProviderPlayerRow>()

  for (const row of rows) {
    const key = normalizeName(row.playerName)
    const existing = deduped.get(key)

    if (!existing) {
      deduped.set(key, row)
      continue
    }

    const existingCompleteness = [
      existing.positionText,
      existing.totalToPar,
      existing.todayToPar,
      existing.thru,
      existing.round1,
      existing.round2,
      existing.round3,
      existing.round4,
    ].filter((value) => value != null).length

    const incomingCompleteness = [
      row.positionText,
      row.totalToPar,
      row.todayToPar,
      row.thru,
      row.round1,
      row.round2,
      row.round3,
      row.round4,
    ].filter((value) => value != null).length

    if (incomingCompleteness > existingCompleteness) {
      deduped.set(key, row)
    }
  }

  return Array.from(deduped.values())
}

function extractLeaderboardTextWindow(pageText: string): string | null {
  const headerPattern = /POS\s+PLAYER\s+SCORE\s+R1\s+R2\s+R3\s+R4\s+TOT/i
  const headerMatch = pageText.match(headerPattern)

  if (!headerMatch || headerMatch.index == null) {
    return null
  }

  const start = headerMatch.index + headerMatch[0].length
  const afterHeader = pageText.slice(start)

  const stopPatterns = [
    /\bTop Performers\b/i,
    /\bAll Players\b/i,
    /\bPlayer Stats\b/i,
    /\bCourse Stats\b/i,
    /\bTournament News\b/i,
    /\bESPN BET\b/i,
    /\bSee All\b/i,
  ]

  let endIndex = afterHeader.length
  for (const pattern of stopPatterns) {
    const match = afterHeader.match(pattern)
    if (match && match.index != null) {
      endIndex = Math.min(endIndex, match.index)
    }
  }

  return afterHeader.slice(0, endIndex).trim()
}

function parseLeaderboardRowsFromText(pageText: string): ProviderPlayerRow[] {
  const windowText = extractLeaderboardTextWindow(pageText)
  if (!windowText) return []

  const rows: ProviderPlayerRow[] = []

  const rowPattern =
    /(T?\d+|CUT|MC)\s+([A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’.\- ]+?)\s+(-?\d+|\+\d+|E)\s+(\d{2,3})\s+(\d{2,3})\s+(\d{2,3})\s+(\d{2,3})\s+(\d{2,3})(?=\s+\$|\s+\d+\b|$)/g

  let match: RegExpExecArray | null
  while ((match = rowPattern.exec(windowText)) !== null) {
    const positionText = match[1]?.trim() ?? null
    const playerName = match[2]?.replace(/\s+/g, ' ').trim() ?? ''
    const totalToPar = parseToPar(match[3] ?? null)
    const round1 = parseInteger(match[4] ?? null)
    const round2 = parseInteger(match[5] ?? null)
    const round3 = parseInteger(match[6] ?? null)
    const round4 = parseInteger(match[7] ?? null)
    const totalStrokes = parseInteger(match[8] ?? null)

    if (!playerName) continue

    const derivedTodayToPar =
      round1 != null &&
      round2 != null &&
      round3 != null &&
      round4 != null &&
      totalStrokes != null
        ? totalStrokes - (round1 + round2 + round3)
        : null

    rows.push({
      playerName,
      source: 'espn',
      positionText,
      totalToPar,
      todayToPar: derivedTodayToPar,
      thru: 'F',
      holesCompleted: 18,
      currentRound: 4,
      round1,
      round2,
      round3,
      round4,
      madeCut: inferMadeCut(positionText),
      status: 'Final',
      sourceUpdatedAt: null,
      rawPayload: {
        parser: 'espn_text_leaderboard',
        totalStrokes,
      },
    })
  }

  return dedupeRows(rows)
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

function getString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function getNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const parsed = parseInteger(value)
      if (parsed != null) return parsed
    }
  }
  return null
}

function getNestedObject(
  record: Record<string, unknown>,
  keys: string[]
): Record<string, unknown> | null {
  for (const key of keys) {
    const value = record[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>
    }
  }
  return null
}

function extractRoundScoreFromLine(line: unknown, roundNumber: number): number | null {
  if (!line || typeof line !== 'object') return null
  const record = line as Record<string, unknown>

  const period =
    getNumber(record, ['period', 'round', 'roundNumber', 'displayPeriod']) ??
    parseInteger(getString(record, ['period', 'round', 'roundNumber', 'displayPeriod']))

  if (period != null && period !== roundNumber) return null

  const directScore = getNumber(record, ['value', 'score', 'strokes', 'displayValue'])
  if (directScore != null) return directScore

  const displayValue = getString(record, ['displayValue', 'display', 'label'])
  return parseInteger(displayValue)
}

function extractRoundScores(record: Record<string, unknown>) {
  let round1: number | null = getNumber(record, ['round1', 'r1'])
  let round2: number | null = getNumber(record, ['round2', 'r2'])
  let round3: number | null = getNumber(record, ['round3', 'r3'])
  let round4: number | null = getNumber(record, ['round4', 'r4'])

  const linescoresCandidate =
    record.linescores ??
    record.lineScores ??
    record.rounds ??
    record.scorecards ??
    null

  if (Array.isArray(linescoresCandidate)) {
    for (const item of linescoresCandidate) {
      const maybeRound1 = extractRoundScoreFromLine(item, 1)
      const maybeRound2 = extractRoundScoreFromLine(item, 2)
      const maybeRound3 = extractRoundScoreFromLine(item, 3)
      const maybeRound4 = extractRoundScoreFromLine(item, 4)

      if (round1 == null && maybeRound1 != null) round1 = maybeRound1
      if (round2 == null && maybeRound2 != null) round2 = maybeRound2
      if (round3 == null && maybeRound3 != null) round3 = maybeRound3
      if (round4 == null && maybeRound4 != null) round4 = maybeRound4
    }
  }

  return { round1, round2, round3, round4 }
}

function extractRowsFromEspnJson(payload: unknown): ProviderPlayerRow[] {
  const allObjects = flattenObjects(payload)
  const rows: ProviderPlayerRow[] = []

  for (const node of allObjects) {
    if (!node || typeof node !== 'object') continue
    const record = node as Record<string, unknown>

    const athlete = getNestedObject(record, ['athlete', 'competitor', 'player'])
    const playerName =
      getString(record, ['displayName', 'shortName', 'fullName', 'name']) ??
      (athlete ? getString(athlete, ['displayName', 'shortName', 'fullName', 'name']) : null)

    if (!playerName) continue

    const positionObject = getNestedObject(record, ['position'])
    const positionText =
      (positionObject ? getString(positionObject, ['displayValue', 'abbreviation', 'value']) : null) ??
      getString(record, ['positionText', 'positionDisplay', 'rank', 'rankDisplay', 'pos'])

    const totalToPar = parseToPar(
      getString(record, ['toPar', 'totalToPar', 'scoreToPar', 'score']) ??
        (typeof record.toPar === 'number' ? record.toPar : null) ??
        (typeof record.totalToPar === 'number' ? record.totalToPar : null)
    )

    const todayToPar = parseToPar(
      getString(record, ['today', 'todayToPar', 'currentRoundToPar']) ??
        (typeof record.today === 'number' ? record.today : null) ??
        (typeof record.todayToPar === 'number' ? record.todayToPar : null)
    )

    const thru =
      getString(record, ['thru', 'through', 'holesThrough']) ??
      (positionObject ? getString(positionObject, ['thru']) : null)

    const holesCompleted =
      getNumber(record, ['holesCompleted']) ??
      (typeof thru === 'string' && /^\d+$/.test(thru) ? Number.parseInt(thru, 10) : null)

    const { round1, round2, round3, round4 } = extractRoundScores(record)

    const hasUsefulData =
      positionText != null ||
      totalToPar != null ||
      todayToPar != null ||
      thru != null ||
      holesCompleted != null ||
      round1 != null ||
      round2 != null ||
      round3 != null ||
      round4 != null

    if (!hasUsefulData) continue

    rows.push({
      playerName,
      source: 'espn',
      positionText,
      totalToPar,
      todayToPar,
      thru,
      holesCompleted,
      currentRound: null,
      round1,
      round2,
      round3,
      round4,
      madeCut: inferMadeCut(positionText),
      status: null,
      sourceUpdatedAt: null,
      rawPayload: record,
    })
  }

  return dedupeRows(rows)
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
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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

    const pageText = stripTags(html)
    const textRows = parseLeaderboardRowsFromText(pageText)

    if (textRows.length > 0) {
      return {
        source: 'espn',
        success: true,
        rows: textRows,
        message: `Parsed ${textRows.length} leaderboard rows from ESPN page text`,
      }
    }

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

    const rows = dedupeRows(allRows)

    return {
      source: 'espn',
      success: rows.length > 0,
      rows,
      message:
        rows.length > 0
          ? `Parsed ${rows.length} leaderboard rows from ESPN JSON fallback`
          : 'No parseable leaderboard rows found on ESPN page',
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