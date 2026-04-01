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
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<img[^>]*>/gi, ' ')
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
  const map = new Map<string, ProviderPlayerRow>()

  for (const row of rows) {
    const key = normalizeName(row.playerName)
    const existing = map.get(key)

    if (!existing) {
      map.set(key, row)
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
      map.set(key, row)
    }
  }

  return Array.from(map.values())
}

function extractLeaderboardTextWindow(pageText: string): string | null {
  const headerPattern = /Final\s+POS\s+PLAYER\s+SCORE\s+R1\s+R2\s+R3\s+R4\s+TOT/i
  const altHeaderPattern = /POS\s+PLAYER\s+SCORE\s+R1\s+R2\s+R3\s+R4\s+TOT/i

  let match = pageText.match(headerPattern)
  if (!match || match.index == null) {
    match = pageText.match(altHeaderPattern)
  }

  if (!match || match.index == null) {
    return null
  }

  const afterHeader = pageText.slice(match.index + match[0].length)

  const stopPatterns = [
    /\bTop Performers\b/i,
    /\bPlayer Stats\b/i,
    /\bCourse Stats\b/i,
    /\bTournament News\b/i,
    /\bESPN BET\b/i,
    /\bSee All\b/i,
    /\bSchedule\b/i,
  ]

  let endIndex = afterHeader.length
  for (const pattern of stopPatterns) {
    const stop = afterHeader.match(pattern)
    if (stop && stop.index != null) {
      endIndex = Math.min(endIndex, stop.index)
    }
  }

  return afterHeader.slice(0, endIndex).trim()
}

function parseLeaderboardRowsFromText(pageText: string): ProviderPlayerRow[] {
  const textWindow = extractLeaderboardTextWindow(pageText)
  if (!textWindow) return []

  const normalizedWindow = textWindow
    .normalize('NFKC')
    .replace(/\$/g, ' $')
    .replace(/([A-Z])\$/g, '$1 $')
    .replace(/\s+/g, ' ')
    .trim()

  const rows: ProviderPlayerRow[] = []

  const rowPattern =
    /(T?\d+|CUT|MC)\s+([A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’.\- ]+?)\s+(-?\d+|\+\d+|E)\s+(\d{2,3})\s+(\d{2,3})\s+(\d{2,3})\s+(\d{2,3})\s+(\d{2,3})(?=\s+\$|\s+\d+\b|$)/g

  let match: RegExpExecArray | null
  while ((match = rowPattern.exec(normalizedWindow)) !== null) {
    const positionText = match[1]?.trim() ?? null
    const playerName = match[2]?.replace(/\s+/g, ' ').trim() ?? ''
    const totalToPar = parseToPar(match[3] ?? null)
    const round1 = parseInteger(match[4] ?? null)
    const round2 = parseInteger(match[5] ?? null)
    const round3 = parseInteger(match[6] ?? null)
    const round4 = parseInteger(match[7] ?? null)
    const totalStrokes = parseInteger(match[8] ?? null)

    if (!playerName) continue

    const todayToPar =
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
      todayToPar,
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
        parser: 'espn_public_page_text',
        totalStrokes,
      },
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
        message: `ESPN page fetch failed: ${res.status}`,
      }
    }

    const html = await res.text()
    const pageText = stripTags(html)
    const rows = parseLeaderboardRowsFromText(pageText)

    return {
      source: 'espn',
      success: rows.length > 0,
      rows,
      message:
        rows.length > 0
          ? `Parsed ${rows.length} players from ESPN public leaderboard page`
          : 'No parseable leaderboard rows found on ESPN public page',
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