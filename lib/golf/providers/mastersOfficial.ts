import fs from 'node:fs/promises'
import path from 'node:path'
import type { ProviderFetchResult, ProviderPlayerRow } from './types'

const BASE_URL = 'https://www.masters.com'

const CANDIDATE_ENDPOINTS = [
  '/api/en_US/scores/leaderboard',
  '/api/en_US/scores',
  '/api/en_US/leaderboard',
  '/api/en_US/scores/current',
  '/api/en_US/live/leaderboard',
  '/api/en_US/live/scores',
  '/api/scores/leaderboard',
  '/api/scores',
  '/api/leaderboard',
]

function parseToPar(value: string | number | null | undefined): number | null {
  if (value == null) return null
  if (typeof value === 'number') return value

  const cleaned = value.trim().toUpperCase()
  if (!cleaned || cleaned === 'E') return 0

  const normalized = cleaned.replace('−', '-').replace('+', '')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
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

function readString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function readNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const n = Number(value)
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

function extractRowsFromJson(payload: unknown): ProviderPlayerRow[] {
  const allObjects = flattenObjects(payload)
  const rows: ProviderPlayerRow[] = []

  for (const node of allObjects) {
    if (!node || typeof node !== 'object') continue
    const record = node as Record<string, unknown>

    const playerName = readString(record, [
      'player_name',
      'name',
      'full_name',
      'display_name',
      'fullName',
      'playerName',
      'shortName',
    ])

    const positionText = readString(record, [
      'position',
      'position_text',
      'pos',
      'rank',
      'place',
      'leaderboard_position',
    ])

    const totalToPar = parseToPar(
      readString(record, ['total_to_par', 'to_par', 'score', 'overall_score']) ??
        readNumber(record, ['total_to_par', 'to_par', 'score', 'overall_score'])
    )

    const todayToPar = parseToPar(
      readString(record, ['today_to_par', 'today', 'round_score']) ??
        readNumber(record, ['today_to_par', 'today', 'round_score'])
    )

    const thru = readString(record, [
      'thru',
      'through',
      'holes_completed_text',
      'status',
      'current_hole',
      'thruText',
    ])

    const holesCompleted =
      readNumber(record, ['holes_completed']) ??
      (typeof thru === 'string' && /^\d+$/.test(thru) ? Number(thru) : null)

    const currentRound = readNumber(record, ['current_round', 'round'])
    const round1 = readNumber(record, ['round_1', 'r1'])
    const round2 = readNumber(record, ['round_2', 'r2'])
    const round3 = readNumber(record, ['round_3', 'r3'])
    const round4 = readNumber(record, ['round_4', 'r4'])

    const status = readString(record, ['status', 'player_status'])
    const madeCutValue = record.made_cut
    const madeCut =
      typeof madeCutValue === 'boolean'
        ? madeCutValue
        : typeof madeCutValue === 'string'
          ? madeCutValue.toLowerCase() === 'true'
          : null

    if (
      playerName &&
      (positionText || totalToPar !== null || todayToPar !== null || thru || status)
    ) {
      rows.push({
        playerName,
        source: 'masters_official',
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
  }

  const deduped = new Map<string, ProviderPlayerRow>()
  for (const row of rows) {
    if (!deduped.has(row.playerName)) deduped.set(row.playerName, row)
  }

  return Array.from(deduped.values())
}

async function writeDebugFiles(
  results: Array<{
    endpoint: string
    status: number
    bodyPreview: string
    extractedRows: number
  }>
) {
  if (process.env.NODE_ENV !== 'development') return

  const dir = path.join(process.cwd(), '.debug')
  await fs.mkdir(dir, { recursive: true })

  const output = results
    .map(
      (r) =>
        `ENDPOINT: ${r.endpoint}\nSTATUS: ${r.status}\nEXTRACTED_ROWS: ${r.extractedRows}\nBODY_PREVIEW:\n${r.bodyPreview}\n\n========================\n`
    )
    .join('\n')

  await fs.writeFile(path.join(dir, 'masters-api-probe.txt'), output, 'utf8')
}

export async function fetchMastersOfficialLeaderboard(): Promise<ProviderFetchResult> {
  const debugResults: Array<{
    endpoint: string
    status: number
    bodyPreview: string
    extractedRows: number
  }> = []

  try {
    for (const endpoint of CANDIDATE_ENDPOINTS) {
      const url = `${BASE_URL}${endpoint}`

      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            Accept: 'application/json,text/plain,*/*',
          },
          cache: 'no-store',
        })

        const text = await res.text()
        const bodyPreview = text.slice(0, 2500)

        let extractedRows = 0

        try {
          const json = JSON.parse(text)
          const rows = extractRowsFromJson(json)
          extractedRows = rows.length

          debugResults.push({
            endpoint,
            status: res.status,
            bodyPreview,
            extractedRows,
          })

          if (res.ok && rows.length > 0) {
            await writeDebugFiles(debugResults)

            return {
              source: 'masters_official',
              success: true,
              rows,
              message: `Using Masters endpoint ${endpoint}`,
            }
          }
        } catch {
          debugResults.push({
            endpoint,
            status: res.status,
            bodyPreview,
            extractedRows,
          })
        }
      } catch (error) {
        debugResults.push({
          endpoint,
          status: 0,
          bodyPreview: error instanceof Error ? error.message : 'Unknown fetch error',
          extractedRows: 0,
        })
      }
    }

    await writeDebugFiles(debugResults)

    return {
      source: 'masters_official',
      success: false,
      rows: [],
      message: 'No usable Masters API endpoint returned parseable leaderboard rows',
    }
  } catch (error) {
    return {
      source: 'masters_official',
      success: false,
      rows: [],
      message: error instanceof Error ? error.message : 'Unknown Masters official error',
    }
  }
}