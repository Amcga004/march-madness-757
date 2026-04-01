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

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .trim()
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

function extractRoundScoreFromLine(
  line: unknown,
  roundNumber: number
): number | null {
  if (!line || typeof line !== 'object') return null
  const record = line as Record<string, unknown>

  const period =
    getNumber(record, ['period', 'round', 'roundNumber', 'displayPeriod']) ??
    parseInteger(getString(record, ['period', 'round', 'roundNumber', 'displayPeriod']))

  if (period != null && period !== roundNumber) return null

  const directScore = getNumber(record, ['value', 'score', 'strokes', 'displayValue'])
  if (directScore != null) return directScore

  const displayValue = getString(record, ['displayValue', 'display', 'label'])
  const parsedDisplay = parseInteger(displayValue)
  if (parsedDisplay != null) return parsedDisplay

  return null
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

  const statistics = Array.isArray(record.statistics) ? record.statistics : null
  if (statistics) {
    for (const stat of statistics) {
      if (!stat || typeof stat !== 'object') continue
      const statRecord = stat as Record<string, unknown>

      const name = (
        getString(statRecord, ['name', 'displayName', 'shortDisplayName']) ?? ''
      ).toLowerCase()

      const value = getNumber(statRecord, ['value', 'displayValue'])
      if (value == null) continue

      if (round1 == null && (name === 'r1' || name.includes('round 1'))) round1 = value
      if (round2 == null && (name === 'r2' || name.includes('round 2'))) round2 = value
      if (round3 == null && (name === 'r3' || name.includes('round 3'))) round3 = value
      if (round4 == null && (name === 'r4' || name.includes('round 4'))) round4 = value
    }
  }

  return { round1, round2, round3, round4 }
}

function inferCurrentRound(
  rounds: Array<number | null>,
  thru: string | null,
  holesCompleted: number | null
): number | null {
  const completedRounds = rounds.filter((value) => value != null).length
  const normalizedThru = thru?.trim().toUpperCase() ?? ''

  if (completedRounds === 0) return null

  if (normalizedThru === 'F') {
    if (completedRounds >= 4) return 4
    return completedRounds
  }

  if (holesCompleted != null && holesCompleted >= 1 && holesCompleted <= 18) {
    return Math.min(completedRounds + 1, 4)
  }

  return Math.min(completedRounds, 4)
}

function inferStatus(
  thru: string | null,
  currentRound: number | null,
  rounds: Array<number | null>,
  rawStatus: string | null
): string {
  if (rawStatus?.trim()) return rawStatus.trim()

  const normalizedThru = thru?.trim().toUpperCase() ?? ''

  if (rounds.every((value) => value == null) && !normalizedThru) return 'Not Started'
  if (normalizedThru === 'F' && rounds.filter((value) => value != null).length >= 4) return 'Final'
  if (normalizedThru === 'F') return 'Round Complete'
  if (normalizedThru) return 'In Progress'
  if (currentRound != null) return 'In Progress'
  return 'Not Started'
}

function inferMadeCut(
  rounds: Array<number | null>,
  positionText: string | null,
  status: string | null
): boolean | null {
  const completedRounds = rounds.filter((value) => value != null).length
  const normalizedPosition = positionText?.trim().toUpperCase() ?? ''
  const normalizedStatus = status?.toLowerCase() ?? ''

  if (normalizedPosition === 'CUT' || normalizedPosition === 'MC') return false
  if (completedRounds >= 3) return true
  if (normalizedStatus.includes('final') && completedRounds >= 2) return true
  if (completedRounds < 2) return null
  return null
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
    const currentRound =
      getNumber(record, ['currentRound', 'round']) ??
      inferCurrentRound([round1, round2, round3, round4], thru, holesCompleted)

    const rawStatus = getString(record, ['status'])
    const status = inferStatus(thru, currentRound, [round1, round2, round3, round4], rawStatus)

    const madeCut =
      typeof record.madeCut === 'boolean'
        ? record.madeCut
        : inferMadeCut([round1, round2, round3, round4], positionText, status)

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
      currentRound,
      round1,
      round2,
      round3,
      round4,
      madeCut,
      status,
      sourceUpdatedAt: null,
      rawPayload: record,
    })
  }

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

    const scriptMatches = Array.from(
      html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)
    ).map((m) => m[1])

    const allRows: ProviderPlayerRow[] = []
    let debugLogged = false

    for (const block of scriptMatches) {
      const trimmed = block.trim()
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) continue

      const parsed = safeJsonParse<unknown>(trimmed)

      if (parsed && typeof parsed === 'object' && !debugLogged) {
        const str = JSON.stringify(parsed)
        if (
          str.includes('leaderboard') ||
          str.includes('competitor') ||
          str.includes('linescores') ||
          str.includes('displayName')
        ) {
          console.log('POTENTIAL ESPN STRUCTURE:', str.slice(0, 4000))
          debugLogged = true
        }
      }

      if (!parsed) continue

      const rows = extractRowsFromEspnJson(parsed)
      if (rows.length > 0) {
        allRows.push(...rows)
      }
    }

    const deduped = new Map<string, ProviderPlayerRow>()
    for (const row of allRows) {
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

    const rows = Array.from(deduped.values())

    return {
      source: 'espn',
      success: rows.length > 0,
      rows,
      message:
        rows.length > 0
          ? `Parsed ${rows.length} leaderboard rows from ESPN JSON`
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