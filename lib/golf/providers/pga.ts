import type { ProviderFetchResult, ProviderPlayerRow } from './types'

function parseToPar(value: string | number | null | undefined): number | null {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  const cleaned = value.trim().toUpperCase()
  if (!cleaned || cleaned === 'E') return 0

  const normalized = cleaned.replace('−', '-').replace('+', '')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

function parseIntSafe(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const cleaned = value.trim()
    if (!cleaned) return null
    const n = Number.parseInt(cleaned, 10)
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

function deriveStatus(player: Record<string, unknown>, roundCount: number): string {
  const rawStatus =
    typeof player.status === 'string'
      ? player.status
      : typeof player.playerStatus === 'string'
        ? player.playerStatus
        : null

  if (rawStatus && rawStatus.trim()) return rawStatus.trim()

  const thru =
    typeof player.thru === 'string'
      ? player.thru.trim().toUpperCase()
      : typeof player.thru === 'number'
        ? String(player.thru)
        : null

  if (thru === 'F' && roundCount >= 4) return 'Final'
  if (thru === 'F') return 'Round Complete'
  if (thru) return 'In Progress'
  return 'Not Started'
}

function deriveCurrentRound(player: Record<string, unknown>, rounds: Array<number | null>): number | null {
  const explicitRound =
    parseIntSafe(player.round) ??
    parseIntSafe(player.currentRound) ??
    parseIntSafe(player.roundNumber)

  if (explicitRound != null) return explicitRound

  const thru =
    typeof player.thru === 'string'
      ? player.thru.trim().toUpperCase()
      : typeof player.thru === 'number'
        ? String(player.thru)
        : null

  const completedRounds = rounds.filter((r) => r != null).length
  if (completedRounds === 0) return null
  if (thru === 'F') return Math.min(completedRounds, 4)
  return Math.min(completedRounds + 1, 4)
}

function deriveMadeCut(player: Record<string, unknown>, positionText: string | null, rounds: Array<number | null>): boolean | null {
  const completedRounds = rounds.filter((r) => r != null).length

  const rawMadeCut = player.madeCut
  if (typeof rawMadeCut === 'boolean') return rawMadeCut

  const normalizedPosition = positionText?.trim().toUpperCase() ?? ''
  if (normalizedPosition === 'CUT' || normalizedPosition === 'MC') return false
  if (completedRounds >= 3) return true
  if (completedRounds < 2) return null
  return null
}

function extractRoundStrokes(player: Record<string, unknown>): {
  round1: number | null
  round2: number | null
  round3: number | null
  round4: number | null
} {
  const directRound1 = parseIntSafe(player.round1) ?? parseIntSafe(player.r1)
  const directRound2 = parseIntSafe(player.round2) ?? parseIntSafe(player.r2)
  const directRound3 = parseIntSafe(player.round3) ?? parseIntSafe(player.r3)
  const directRound4 = parseIntSafe(player.round4) ?? parseIntSafe(player.r4)

  let round1 = directRound1
  let round2 = directRound2
  let round3 = directRound3
  let round4 = directRound4

  const rounds = Array.isArray(player.rounds) ? player.rounds : []

  for (let i = 0; i < rounds.length; i += 1) {
    const round = rounds[i]
    if (!round || typeof round !== 'object') continue

    const roundRecord = round as Record<string, unknown>
    const strokes =
      parseIntSafe(roundRecord.strokes) ??
      parseIntSafe(roundRecord.score) ??
      parseIntSafe(roundRecord.value)

    const roundNumber =
      parseIntSafe(roundRecord.roundNumber) ??
      parseIntSafe(roundRecord.round) ??
      i + 1

    if (roundNumber === 1 && round1 == null) round1 = strokes
    if (roundNumber === 2 && round2 == null) round2 = strokes
    if (roundNumber === 3 && round3 == null) round3 = strokes
    if (roundNumber === 4 && round4 == null) round4 = strokes
  }

  return { round1, round2, round3, round4 }
}

function extractPlayersFromJson(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== 'object') return []

  const root = payload as Record<string, unknown>

  const candidates: unknown[] = [
    root.leaderboard,
    root.data,
    root
  ]

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    const record = candidate as Record<string, unknown>

    const possibleArrays: unknown[] = [
      record.players,
      record.playersList,
      record.leaderboardRows,
      record.entries,
      record.results
    ]

    for (const arr of possibleArrays) {
      if (Array.isArray(arr)) {
        return arr.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      }
    }
  }

  return []
}

export async function fetchPgaLeaderboard(): Promise<ProviderFetchResult> {
  const tournamentId = 'R2026020'

  try {
    const url = `https://statdata.pgatour.com/r/${tournamentId}/leaderboard-v2mini.json`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json,text/plain,*/*',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      return {
        source: 'pga',
        success: false,
        rows: [],
        message: `PGA JSON fetch failed: ${res.status}`,
      }
    }

    const json = await res.json()
    const players = extractPlayersFromJson(json)

    if (players.length === 0) {
      return {
        source: 'pga',
        success: false,
        rows: [],
        message: 'No players found in PGA JSON feed',
      }
    }

    const rows: ProviderPlayerRow[] = []

    for (const player of players) {
      const playerBio =
        player.player_bio && typeof player.player_bio === 'object'
          ? (player.player_bio as Record<string, unknown>)
          : null

      const playerName =
        (typeof player.playerName === 'string' && player.playerName.trim()) ||
        (typeof player.player_name === 'string' && player.player_name.trim()) ||
        (typeof player.full_name === 'string' && player.full_name.trim()) ||
        (typeof player.name === 'string' && player.name.trim()) ||
        (playerBio && typeof playerBio.full_name === 'string' && playerBio.full_name.trim()) ||
        (playerBio && typeof playerBio.player_name === 'string' && playerBio.player_name.trim()) ||
        null

      if (!playerName) continue

      const positionText =
        (typeof player.current_position === 'string' && player.current_position.trim()) ||
        (typeof player.position === 'string' && player.position.trim()) ||
        (typeof player.pos === 'string' && player.pos.trim()) ||
        (typeof player.rank === 'string' && player.rank.trim()) ||
        null

      const totalToPar = parseToPar(
        (typeof player.total === 'string' || typeof player.total === 'number'
          ? player.total
          : null) ??
          (typeof player.totalToPar === 'string' || typeof player.totalToPar === 'number'
            ? player.totalToPar
            : null) ??
          (typeof player.total_to_par === 'string' || typeof player.total_to_par === 'number'
            ? player.total_to_par
            : null) ??
          (typeof player.score === 'string' || typeof player.score === 'number'
            ? player.score
            : null)
      )

      const todayToPar = parseToPar(
        (typeof player.today === 'string' || typeof player.today === 'number'
          ? player.today
          : null) ??
          (typeof player.todayToPar === 'string' || typeof player.todayToPar === 'number'
            ? player.todayToPar
            : null) ??
          (typeof player.today_to_par === 'string' || typeof player.today_to_par === 'number'
            ? player.today_to_par
            : null)
      )

      const thru =
        (typeof player.thru === 'string' && player.thru.trim()) ||
        (typeof player.thru === 'number' ? String(player.thru) : null) ||
        (typeof player.through === 'string' && player.through.trim()) ||
        null

      const holesCompleted =
        parseIntSafe(player.holesCompleted) ??
        (typeof thru === 'string' && /^\d+$/.test(thru) ? Number.parseInt(thru, 10) : null)

      const { round1, round2, round3, round4 } = extractRoundStrokes(player)
      const rounds = [round1, round2, round3, round4]
      const currentRound = deriveCurrentRound(player, rounds)
      const status = deriveStatus(player, rounds.filter((r) => r != null).length)
      const madeCut = deriveMadeCut(player, positionText, rounds)

      const hasUsefulData =
        positionText != null ||
        totalToPar != null ||
        todayToPar != null ||
        thru != null ||
        round1 != null ||
        round2 != null ||
        round3 != null ||
        round4 != null

      if (!hasUsefulData) continue

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
        madeCut,
        status,
        sourceUpdatedAt: null,
        rawPayload: player,
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
        existing.round1,
        existing.round2,
        existing.round3,
        existing.round4,
      ].filter((value) => value != null).length

      const incomingCompleteness = [
        row.positionText,
        row.totalToPar,
        row.todayToPar,
        row.round1,
        row.round2,
        row.round3,
        row.round4,
      ].filter((value) => value != null).length

      if (incomingCompleteness > existingCompleteness) {
        deduped.set(key, row)
      }
    }

    const finalRows = Array.from(deduped.values())

    return {
      source: 'pga',
      success: finalRows.length > 0,
      rows: finalRows,
      message:
        finalRows.length > 0
          ? `Parsed ${finalRows.length} players from PGA JSON`
          : 'No parseable rows found in PGA JSON feed',
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